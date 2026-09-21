import assert from 'node:assert/strict';
import test from 'node:test';
import { EMAIL_CATEGORY_SEEDS } from '../src/seeds/emailCategoryPhrases.js';
import {
  normalizePhrase,
  seedEmailCategoryPhrases,
  tokenCount
} from '../src/services/phraseKnowledgeService.js';

test('normalizes unicode, separators, punctuation, and whitespace deterministically', () => {
  assert.equal(normalizePhrase('  REQUEST_SI — Please!!!  '), 'request si - please');
  assert.equal(normalizePhrase('ＣＵＳＴ  SI'), 'cust si');
  assert.equal(tokenCount('draft bill of lading'), 4);
});

test('builds idempotent seed upserts without sample submission data', async () => {
  let operations;
  const knowledgeModel = {
    async bulkWrite(received) {
      operations = received;
      return { upsertedCount: received.length };
    }
  };
  const events = [];
  const auditModel = { async create(event) { events.push(event); } };

  const result = await seedEmailCategoryPhrases({ knowledgeModel, auditModel });

  assert.equal(result.total, EMAIL_CATEGORY_SEEDS.length);
  assert.equal(operations.length, EMAIL_CATEGORY_SEEDS.length);
  assert.ok(operations.every(({ updateOne }) => updateOne.upsert));
  assert.ok(operations.every(({ updateOne }) => updateOne.filter.normalizedPhrase));
  assert.equal(events[0].eventType, 'knowledge.seeded');
});
