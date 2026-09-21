import { classificationConfig } from '../constants/classification.js';
import { EMAIL_CATEGORIES } from '../constants/challenge.js';
import { EMAIL_CATEGORY_SEEDS } from '../seeds/emailCategoryPhrases.js';
import { normalizePhrase, tokenCount } from './phraseKnowledgeService.js';

const TRUST_MULTIPLIER_KEYS = Object.freeze({
  seed: 'seedTrustMultiplier',
  trusted: 'trustedTrustMultiplier',
  probation: 'probationTrustMultiplier'
});

export function stripQuotedAndSignatureText(value) {
  return String(value ?? '')
    .split(/\n(?:_{8,}|-{8,})\s*\n|\nfrom:\s|\nbest regards[,\s]*\n/i)[0]
    .trim();
}

function sourceEvidence(source, canonicalPhrase) {
  const escaped = canonicalPhrase
    .split(/\s+/)
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('[\\s_\\/\\\\|]+');
  const match = String(source ?? '').match(new RegExp(escaped, 'iu'));
  return match?.[0] ?? canonicalPhrase;
}

function preparedSeedEntries() {
  return EMAIL_CATEGORY_SEEDS.map((entry) => ({
    ...entry,
    normalizedPhrase: normalizePhrase(entry.phrase),
    tokenCount: tokenCount(entry.phrase)
  }));
}

export const DEFAULT_PHRASE_ENTRIES = Object.freeze(preparedSeedEntries());

export function scoreEmail(email, phraseEntries = DEFAULT_PHRASE_ENTRIES, config = classificationConfig()) {
  const sources = {
    subject: String(email.subject ?? ''),
    body: stripQuotedAndSignatureText(email.body ?? '')
  };
  const normalizedSources = {
    subject: normalizePhrase(sources.subject),
    body: normalizePhrase(sources.body)
  };
  const scores = Object.fromEntries(EMAIL_CATEGORIES.map((category) => [category, 0]));
  const matchedEvidence = [];
  const sortedEntries = [...phraseEntries].sort((left, right) => (
    (right.tokenCount ?? tokenCount(right.phrase)) - (left.tokenCount ?? tokenCount(left.phrase))
  ));

  for (const entry of sortedEntries) {
    if (['blocked', 'retired'].includes(entry.status)) continue;
    const normalized = entry.normalizedPhrase ?? normalizePhrase(entry.phrase);
    const locations = entry.allowedLocations?.length ? entry.allowedLocations : ['subject', 'body'];
    const trustKey = TRUST_MULTIPLIER_KEYS[entry.status] ?? 'probationTrustMultiplier';
    const trustMultiplier = config[trustKey];

    for (const location of locations) {
      if (!normalizedSources[location]?.includes(normalized)) continue;
      const locationMultiplier = location === 'subject'
        ? config.subjectMultiplier
        : config.bodyMultiplier;
      const score = Number((entry.weight * locationMultiplier * trustMultiplier).toFixed(4));
      scores[entry.target] = Number((scores[entry.target] + score).toFixed(4));
      matchedEvidence.push({
        category: entry.target,
        phrase: sourceEvidence(sources[location], entry.phrase),
        normalizedPhrase: normalized,
        location,
        score,
        knowledgeId: entry._id?.toString?.() ?? null,
        knowledgeStatus: entry.status
      });
    }
  }

  const ranking = Object.entries(scores)
    .sort(([leftCategory, leftScore], [rightCategory, rightScore]) => (
      rightScore - leftScore || leftCategory.localeCompare(rightCategory)
    ));
  const [topCategory, topScore] = ranking[0];
  const secondScore = ranking[1]?.[1] ?? 0;
  const margin = Number((topScore - secondScore).toFixed(4));
  const decisive = topScore >= config.minimumScore && margin >= config.minimumMargin;

  return { scores, matchedEvidence, ranking, topCategory, topScore, secondScore, margin, decisive };
}

export function classifyEmailByRules(email, phraseEntries = DEFAULT_PHRASE_ENTRIES, config = classificationConfig()) {
  const scorecard = scoreEmail(email, phraseEntries, config);
  if (!scorecard.decisive) {
    return {
      category: null,
      method: null,
      confidence: null,
      reason: 'Deterministic score did not meet the score and margin thresholds',
      evidencePhrases: scorecard.matchedEvidence.map(({ phrase }) => phrase),
      matchedEvidence: scorecard.matchedEvidence,
      scores: scorecard.scores,
      scoreMargin: scorecard.margin,
      needsAiFallback: true
    };
  }

  const winningEvidence = scorecard.matchedEvidence.filter(({ category }) => (
    category === scorecard.topCategory
  ));
  const confidence = Math.min(0.99, Number((
    0.65 + Math.min(scorecard.margin / Math.max(scorecard.topScore, 1), 1) * 0.34
  ).toFixed(4)));

  return {
    category: scorecard.topCategory,
    method: 'rule',
    confidence,
    reason: `Matched ${winningEvidence.length} weighted phrase${winningEvidence.length === 1 ? '' : 's'} with a ${scorecard.margin} point lead`,
    evidencePhrases: winningEvidence.map(({ phrase }) => phrase),
    matchedEvidence: winningEvidence,
    scores: scorecard.scores,
    scoreMargin: scorecard.margin,
    needsAiFallback: false
  };
}
