import { EMAIL_CATEGORIES } from '../constants/challenge.js';

function divide(numerator, denominator) {
  return denominator === 0 ? 0 : numerator / denominator;
}

export function evaluateClassifications(examples) {
  const perClass = {};
  for (const category of EMAIL_CATEGORIES) {
    const truePositive = examples.filter((row) => row.expected === category && row.predicted === category).length;
    const falsePositive = examples.filter((row) => row.expected !== category && row.predicted === category).length;
    const falseNegative = examples.filter((row) => row.expected === category && row.predicted !== category).length;
    const precision = divide(truePositive, truePositive + falsePositive);
    const recall = divide(truePositive, truePositive + falseNegative);
    const f1 = divide(2 * precision * recall, precision + recall);
    perClass[category] = { truePositive, falsePositive, falseNegative, precision, recall, f1 };
  }

  const deterministic = examples.filter(({ method }) => method === 'rule').length;
  const ai = examples.filter(({ method }) => method === 'ai').length;
  const fallback = examples.filter(({ predicted }) => !predicted).length;
  const correct = examples.filter(({ expected, predicted }) => expected === predicted).length;
  return {
    total: examples.length,
    correct,
    accuracy: divide(correct, examples.length),
    macroF1: EMAIL_CATEGORIES.reduce((sum, category) => sum + perClass[category].f1, 0) / EMAIL_CATEGORIES.length,
    deterministicCoverage: divide(deterministic, examples.length),
    aiFallbackRate: divide(ai + fallback, examples.length),
    unresolvedFallbacks: fallback,
    perClass
  };
}
