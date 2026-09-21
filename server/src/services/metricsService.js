function sum(values) { return values.reduce((total, value) => total + Number(value ?? 0), 0); }
function ratio(numerator, denominator) { return denominator ? Number((numerator / denominator).toFixed(4)) : 0; }

export function calculateRunMetrics(emails, reviews = [], { previousAiFallbacks = null } = {}) {
  const processed = emails.filter(({ processingState }) => processingState === 'completed');
  const durations = processed.map(({ metrics }) => Number(metrics?.durationMs ?? 0)).sort((a, b) => a - b);
  const stageFallbacks = {
    classification: sum(processed.map(({ metrics }) => metrics?.aiFallbacks?.classification)),
    documentRole: sum(processed.map(({ metrics }) => metrics?.aiFallbacks?.documentRole)),
    documentFields: sum(processed.map(({ metrics }) => metrics?.aiFallbacks?.documentFields))
  };
  const stageCacheHits = {
    classification: sum(processed.map(({ metrics }) => metrics?.cacheHits?.classification)),
    documentRole: sum(processed.map(({ metrics }) => metrics?.cacheHits?.documentRole)),
    documentFields: sum(processed.map(({ metrics }) => metrics?.cacheHits?.documentFields))
  };
  const totalFallbacks = sum(Object.values(stageFallbacks));
  const totalCacheHits = sum(Object.values(stageCacheHits));
  const deterministic = processed.filter(({ metrics }) => (
    sum(Object.values(metrics?.aiFallbacks ?? {})) === 0
  )).length;
  const resolvedReviews = reviews.filter(({ status }) => status === 'resolved').length;
  const inputTokens = sum(processed.map(({ metrics }) => metrics?.usage?.inputTokens));
  const outputTokens = sum(processed.map(({ metrics }) => metrics?.usage?.outputTokens));
  const currentAiFallbacks = totalFallbacks;
  return {
    processed: processed.length,
    deterministicCoverage: ratio(deterministic, processed.length),
    aiFallbacks: { total: totalFallbacks, byStage: stageFallbacks },
    cacheHits: { total: totalCacheHits, rate: ratio(totalCacheHits, totalFallbacks), byStage: stageCacheHits },
    latencyMs: {
      average: durations.length ? Math.round(sum(durations) / durations.length) : 0,
      p95: durations.length ? durations[Math.max(0, Math.ceil(durations.length * 0.95) - 1)] : 0
    },
    tokens: { input: inputTokens, output: outputTokens, total: inputTokens + outputTokens },
    estimatedCostUsd: Number(sum(processed.map(({ metrics }) => metrics?.estimatedCostUsd)).toFixed(8)),
    reviews: {
      total: reviews.length,
      open: reviews.length - resolvedReviews,
      resolved: resolvedReviews,
      rate: ratio(reviews.length, processed.length),
      resolutionRate: ratio(resolvedReviews, reviews.length)
    },
    learningImpact: {
      previousAiFallbacks,
      currentAiFallbacks,
      reduction: previousAiFallbacks === null ? null : previousAiFallbacks - currentAiFallbacks,
      reductionRate: previousAiFallbacks ? ratio(previousAiFallbacks - currentAiFallbacks, previousAiFallbacks) : null
    }
  };
}
