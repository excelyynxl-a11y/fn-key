import { CLASSIFICATION_PROMPT_VERSION } from '../constants/challenge.js';
import { classifyEmailByRules } from './classificationService.js';
import { learnClassificationPhrases } from './learningService.js';
import { classifyEmailWithAi } from './openaiService.js';

export async function classifyEmail(email, {
  phraseEntries,
  aiClassifier = classifyEmailWithAi,
  phraseLearner = learnClassificationPhrases,
  model = process.env.OPENAI_MODEL ?? 'gpt-5.5'
} = {}) {
  const ruleDecision = classifyEmailByRules(email, phraseEntries);
  if (!ruleDecision.needsAiFallback) return ruleDecision;

  const aiDecision = await aiClassifier(email, { model });
  await phraseLearner({
    email,
    category: aiDecision.category,
    evidencePhrases: aiDecision.evidencePhrases,
    responseId: aiDecision.responseId
  });

  return {
    category: aiDecision.category,
    method: 'ai',
    confidence: aiDecision.confidence,
    reason: aiDecision.reason,
    evidencePhrases: aiDecision.evidencePhrases,
    matchedEvidence: aiDecision.evidencePhrases.map((phrase) => ({
      category: aiDecision.category,
      phrase,
      normalizedPhrase: null,
      location: String(email.subject ?? '').includes(phrase) ? 'subject' : 'body',
      score: null,
      knowledgeId: null,
      knowledgeStatus: 'suggested'
    })),
    scores: ruleDecision.scores,
    scoreMargin: ruleDecision.scoreMargin,
    cacheHit: aiDecision.cacheHit,
    model,
    responseId: aiDecision.responseId,
    promptVersion: CLASSIFICATION_PROMPT_VERSION,
    aiAttempts: aiDecision.attempts,
    usage: aiDecision.usage,
    needsAiFallback: false
  };
}
