import assert from 'node:assert/strict';
import test from 'node:test';
import { EMAIL_CATEGORY_SEEDS } from '../src/seeds/emailCategoryPhrases.js';
import {
  normalizePhrase,
  recordKnowledgeUsage,
  seedEmailCategoryPhrases,
  tokenCount
} from '../src/services/phraseKnowledgeService.js';

test('normalizes unicode, separators, punctuation, and whitespace deterministically', () => {
  assert.equal(normalizePhrase('  REQUEST_SI — Please!!!  '), 'request si please');
  assert.equal(normalizePhrase('for checking asap.'), 'for checking asap');
  assert.equal(normalizePhrase('ＣＵＳＴ  SI'), 'cust si');
  assert.equal(tokenCount('draft bill of lading'), 4);
});

test('records one usage per distinct persisted knowledge entry', async () => {
  let operations;
  const result = await recordKnowledgeUsage([
    { knowledgeId: 'a' }, { knowledgeId: 'a' }, { knowledgeId: 'b' }, { knowledgeId: null }
  ], { async bulkWrite(received) { operations = received; return { modifiedCount: received.length }; } });
  assert.equal(result.modifiedCount, 2);
  assert.deepEqual(operations.map(({ updateOne }) => updateOne.filter._id), ['a', 'b']);
  assert.ok(operations.every(({ updateOne }) => updateOne.update.$set.lastUsedAt instanceof Date));
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
