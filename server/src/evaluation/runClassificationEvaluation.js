import fs from 'node:fs/promises';
import path from 'node:path';
import { classificationConfig } from '../constants/classification.js';
import {
  CLASSIFICATION_PROMPT_VERSION,
  KNOWLEDGE_VERSION,
  PIPELINE_VERSION
} from '../constants/challenge.js';
import { classifyEmailByRules } from '../services/classificationService.js';
import { evaluateClassifications } from './classificationEvaluation.js';

const evaluationPath = new URL('./classification-dev-set.json', import.meta.url);
const evaluation = JSON.parse(await fs.readFile(evaluationPath, 'utf8'));
const inboxPath = process.env.DATASET_PATH
  ? path.join(path.resolve(process.env.DATASET_PATH), 'inbox')
  : path.resolve(process.cwd(), '..', 'shipmail-hackathon-bundle', 'inbox');

const rows = [];
for (const example of evaluation.examples) {
  const emailPath = path.join(inboxPath, `${example.emailId}.json`);
  const email = JSON.parse(await fs.readFile(emailPath, 'utf8'));
  const decision = classifyEmailByRules(email);
  rows.push({
    emailId: example.emailId,
    expected: example.category,
    predicted: decision.category,
    method: decision.method,
    scoreMargin: decision.scoreMargin
  });
}

const output = {
  evaluation: evaluation.name,
  source: evaluation.source,
  versions: {
    pipeline: PIPELINE_VERSION,
    knowledge: KNOWLEDGE_VERSION,
    prompt: CLASSIFICATION_PROMPT_VERSION,
    thresholds: classificationConfig()
  },
  metrics: evaluateClassifications(rows),
  rows
};

console.log(JSON.stringify(output, null, 2));
