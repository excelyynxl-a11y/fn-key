import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateRunMetrics } from '../src/services/metricsService.js';

test('calculates deterministic coverage, staged AI usage, latency, cost, and review value', () => {
  const emails = [
    {
      processingState: 'completed',
      metrics: {
        durationMs: 100,
        aiFallbacks: { classification: 0, documentRole: 0, documentFields: 0 },
        cacheHits: { classification: 0, documentRole: 0, documentFields: 0 },
        usage: { inputTokens: 0, outputTokens: 0 }, estimatedCostUsd: 0
      }
    },
    {
      processingState: 'completed',
      metrics: {
        attempts: [
          {
            durationMs: 200,
            aiFallbacks: { classification: 1, documentRole: 0, documentFields: 2 },
            cacheHits: { classification: 1, documentRole: 0, documentFields: 1 },
            usage: { inputTokens: 100, outputTokens: 50 }, estimatedCostUsd: 0.002
          },
          {
            durationMs: 300,
            aiFallbacks: { classification: 0, documentRole: 0, documentFields: 0 },
            cacheHits: { classification: 0, documentRole: 0, documentFields: 0 },
            usage: { inputTokens: 25, outputTokens: 10 }, estimatedCostUsd: 0.0005
          }
        ]
      }
    }
  ];
  const metrics = calculateRunMetrics(emails, [{ status: 'resolved' }, { status: 'open' }], { previousAiFallbacks: 6 });
  assert.equal(metrics.processingAttempts, 3);
  assert.equal(metrics.deterministicCoverage, 1);
  assert.deepEqual(metrics.aiFallbacks, {
    total: 3, byStage: { classification: 1, documentRole: 0, documentFields: 2 }
  });
  assert.equal(metrics.cacheHits.rate, 0.6667);
  assert.deepEqual(metrics.latencyMs, { average: 200, p95: 300 });
  assert.deepEqual(metrics.tokens, { input: 125, output: 60, total: 185 });
  assert.equal(metrics.estimatedCostUsd, 0.0025);
  assert.equal(metrics.reviews.resolutionRate, 0.5);
  assert.equal(metrics.learningImpact.reduction, 3);
});
