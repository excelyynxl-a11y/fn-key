import assert from 'node:assert/strict';
import test from 'node:test';
import { DOCUMENT_KNOWLEDGE_SEEDS } from '../src/seeds/documentKnowledge.js';
import { seedDocumentKnowledge, statusUpdateForAction, updateKnowledgeStatus } from '../src/services/knowledgeService.js';

function query(value) { return { async lean() { return value; } }; }

test('seeds visible document labels and field aliases without shipment values', async () => {
  let operations;
  const events = [];
  const result = await seedDocumentKnowledge({
    knowledgeModel: { async bulkWrite(received) { operations = received; return { upsertedCount: received.length }; } },
    auditModel: { async create(event) { events.push(event); } }
  });
  assert.equal(result.total, DOCUMENT_KNOWLEDGE_SEEDS.length);
  assert.ok(operations.some(({ updateOne }) => updateOne.filter.kind === 'document_label'));
  assert.ok(operations.some(({ updateOne }) => updateOne.filter.kind === 'field_alias'));
  assert.equal(operations.some(({ updateOne }) => /port klang|\d{5}/i.test(updateOne.update.$set.phrase)), false);
  assert.equal(events[0].eventType, 'knowledge.seeded');
});

test('maps moderation actions to reversible knowledge states', () => {
  assert.deepEqual(statusUpdateForAction({ weight: 2 }, 'promote'), { status: 'trusted', weight: 4 });
  assert.deepEqual(statusUpdateForAction({}, 'block'), { status: 'blocked' });
  assert.deepEqual(statusUpdateForAction({}, 'retire'), { status: 'retired' });
  assert.deepEqual(statusUpdateForAction({ source: 'team_seed' }, 'restore'), { status: 'seed' });
  assert.deepEqual(statusUpdateForAction({ source: 'human' }, 'restore'), { status: 'probation' });
});

test('records an immutable before and after audit for knowledge moderation', async () => {
  const events = [];
  const knowledgeModel = {
    findById: () => query({ _id: 'entry-1', kind: 'field_alias', target: 'shipper', phrase: 'exporter', status: 'probation', source: 'human', weight: 2 }),
    findByIdAndUpdate: () => query({ _id: 'entry-1', status: 'trusted', weight: 4 })
  };
  const updated = await updateKnowledgeStatus('entry-1', {
    action: 'promote', note: 'Validated across reviewed documents', reviewer: 'tester'
  }, { knowledgeModel, auditModel: { async create(event) { events.push(event); } } });
  assert.equal(updated.status, 'trusted');
  assert.deepEqual(events[0].details.before, { status: 'probation', weight: 2 });
  assert.deepEqual(events[0].details.after, { status: 'trusted', weight: 4 });
});
