export const CLASSIFICATION_DEFAULTS = Object.freeze({
  minimumScore: 4,
  minimumMargin: 1.5,
  subjectMultiplier: 1.5,
  bodyMultiplier: 1,
  seedTrustMultiplier: 1,
  trustedTrustMultiplier: 1.15,
  probationTrustMultiplier: 0.35,
  maxActivePhrasesPerCategory: 100,
  promotionSupportCount: 3,
  maximumLearnedPhraseWords: 12,
  maximumAiAttempts: 3,
  aiTimeoutMs: 20_000
});

export const GENERIC_PHRASES = Object.freeze([
  'please',
  'attached',
  'document',
  'documents',
  'request',
  'thank you',
  'best regards',
  'dear team',
  'dear all',
  'kindly',
  'shipping documentation',
  'please advise'
]);

function numberFromEnvironment(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

export function classificationConfig() {
  return {
    ...CLASSIFICATION_DEFAULTS,
    minimumScore: numberFromEnvironment('CLASSIFICATION_MIN_SCORE', CLASSIFICATION_DEFAULTS.minimumScore),
    minimumMargin: numberFromEnvironment('CLASSIFICATION_MIN_MARGIN', CLASSIFICATION_DEFAULTS.minimumMargin),
    maximumAiAttempts: Math.max(1, Math.floor(numberFromEnvironment(
      'OPENAI_MAX_ATTEMPTS',
      CLASSIFICATION_DEFAULTS.maximumAiAttempts
    ))),
    aiTimeoutMs: Math.max(1_000, Math.floor(numberFromEnvironment(
      'OPENAI_TIMEOUT_MS',
      CLASSIFICATION_DEFAULTS.aiTimeoutMs
    )))
  };
}
