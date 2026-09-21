import Email from '../models/Email.js';
import ProcessingRun from '../models/ProcessingRun.js';
import ReviewCase from '../models/ReviewCase.js';

function sum(values) { return values.reduce((total, value) => total + Number(value ?? 0), 0); }
function ratio(numerator, denominator) { return denominator ? Number((numerator / denominator).toFixed(4)) : 0; }

export function estimatedAiCost(usage = {}, {
  inputPerMillion = Number(process.env.OPENAI_INPUT_COST_PER_MILLION ?? 0),
  outputPerMillion = Number(process.env.OPENAI_OUTPUT_COST_PER_MILLION ?? 0)
} = {}) {
  return Number((
    Number(usage.inputTokens ?? 0) * inputPerMillion / 1_000_000
    + Number(usage.outputTokens ?? 0) * outputPerMillion / 1_000_000
  ).toFixed(8));
}

function attemptsFor(email) {
  return email.metrics?.attempts?.length ? email.metrics.attempts : [email.metrics ?? {}];
}

function latestAttempt(email) {
  const attempts = attemptsFor(email);
  return attempts.at(-1) ?? {};
}

export function calculateRunMetrics(emails, reviews = [], { previousAiFallbacks = null } = {}) {
  const processed = emails.filter(({ processingState }) => processingState === 'completed');
  const attempts = processed.flatMap(attemptsFor);
  const durations = attempts.map(({ durationMs }) => Number(durationMs ?? 0)).sort((a, b) => a - b);
  const stageFallbacks = {
    classification: sum(attempts.map(({ aiFallbacks }) => aiFallbacks?.classification)),
    documentRole: sum(attempts.map(({ aiFallbacks }) => aiFallbacks?.documentRole)),
    documentFields: sum(attempts.map(({ aiFallbacks }) => aiFallbacks?.documentFields))
  };
  const stageCacheHits = {
    classification: sum(attempts.map(({ cacheHits }) => cacheHits?.classification)),
    documentRole: sum(attempts.map(({ cacheHits }) => cacheHits?.documentRole)),
    documentFields: sum(attempts.map(({ cacheHits }) => cacheHits?.documentFields))
  };
  const totalFallbacks = sum(Object.values(stageFallbacks));
  const totalCacheHits = sum(Object.values(stageCacheHits));
  const deterministic = processed.filter((email) => (
    sum(Object.values(latestAttempt(email).aiFallbacks ?? {})) === 0
  )).length;
  const resolvedReviews = reviews.filter(({ status }) => status === 'resolved').length;
  const inputTokens = sum(attempts.map(({ usage }) => usage?.inputTokens));
  const outputTokens = sum(attempts.map(({ usage }) => usage?.outputTokens));
  const currentAiFallbacks = totalFallbacks;
  return {
    processed: processed.length,
    processingAttempts: attempts.length,
    deterministicCoverage: ratio(deterministic, processed.length),
    aiFallbacks: { total: totalFallbacks, byStage: stageFallbacks },
    cacheHits: { total: totalCacheHits, rate: ratio(totalCacheHits, totalFallbacks), byStage: stageCacheHits },
    latencyMs: {
      average: durations.length ? Math.round(sum(durations) / durations.length) : 0,
      p95: durations.length ? durations[Math.max(0, Math.ceil(durations.length * 0.95) - 1)] : 0
    },
    tokens: { input: inputTokens, output: outputTokens, total: inputTokens + outputTokens },
    estimatedCostUsd: Number(sum(attempts.map(({ estimatedCostUsd }) => estimatedCostUsd)).toFixed(8)),
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

export async function metricsForRun(run, {
  emailModel = Email,
  reviewModel = ReviewCase,
  runModel = ProcessingRun
} = {}) {
  const [emails, reviews, previousRun] = await Promise.all([
    emailModel.find({ lastRunId: run.runId }).select('processingState metrics').lean(),
    reviewModel.find({ runId: run.runId }).select('status').lean(),
    runModel.findOne({
      runId: { $ne: run.runId },
      createdAt: { $lt: run.createdAt },
      state: { $in: ['completed', 'completed_with_errors'] }
    }).sort({ createdAt: -1 }).lean()
  ]);
  if (emails.length === 0 && run.metrics) return run.metrics;
  return calculateRunMetrics(emails, reviews, {
    previousAiFallbacks: previousRun?.metrics?.aiFallbacks?.total
      ?? previousRun?.counts?.aiFallbacks
      ?? null
  });
}

export async function refreshRunMetrics(runId, {
  runModel = ProcessingRun,
  ...models
} = {}) {
  const run = await runModel.findOne({ runId }).lean();
  if (!run) return null;
  const metrics = await metricsForRun(run, { ...models, runModel });
  await runModel.updateOne({ runId }, { $set: { metrics } });
  return metrics;
}
