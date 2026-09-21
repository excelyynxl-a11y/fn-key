import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateClassifications } from '../src/evaluation/classificationEvaluation.js';

test('calculates per-class and coverage metrics without treating fallback as a category', () => {
  const metrics = evaluateClassifications([
    { expected: 'GENERAL', predicted: 'GENERAL', method: 'rule' },
    { expected: 'SPAM', predicted: 'GENERAL', method: 'rule' },
    { expected: 'SPAM', predicted: null, method: null },
    { expected: 'SI_REQUEST', predicted: 'SI_REQUEST', method: 'ai' }
  ]);

  assert.equal(metrics.total, 4);
  assert.equal(metrics.correct, 2);
  assert.equal(metrics.deterministicCoverage, 0.5);
  assert.equal(metrics.aiFallbackRate, 0.5);
  assert.equal(metrics.unresolvedFallbacks, 1);
  assert.equal(metrics.perClass.SPAM.falseNegative, 2);
  assert.equal(metrics.perClass.GENERAL.falsePositive, 1);
});
