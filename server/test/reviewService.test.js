import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { createDatasetRepository } from '../src/repositories/datasetRepository.js';
import { applyHumanFieldOverrides, rolesFromHumanOverride } from '../src/services/pipelineService.js';
import { processEmail } from '../src/services/pipelineService.js';
import { normalizePhrase } from '../src/services/phraseKnowledgeService.js';
import {
  outcomeCounterDelta,
  reopenReview,
  resolveReview,
  reviewStageForReason,
  syncReviewCase
} from '../src/services/reviewService.js';

const repository = createDatasetRepository(path.resolve(process.cwd(), '..', 'shipmail-hackathon-bundle'));

function query(value) { return { async lean() { return value; } }; }

test('maps review reasons to operational stages', () => {
  assert.equal(reviewStageForReason('missing_attachment'), 'attachment');
  assert.equal(reviewStageForReason('unreadable'), 'readability');
  assert.equal(reviewStageForReason('wrong_doc_type'), 'document_role');
  assert.equal(reviewStageForReason('missing_value'), 'field');
});

test('applies human role corrections only for two valid distinct references', () => {
  const attachments = [{ reference: 'a.txt' }, { reference: 'b.txt' }];
  const roles = rolesFromHumanOverride(attachments, {
    siAttachmentReference: 'b.txt', blAttachmentReference: 'a.txt'
  }, 'Reviewer inspected the headers');
  assert.equal(roles.valid, true);
  assert.equal(roles.si.reference, 'b.txt');
  assert.equal(roles.bl.roleMethod, 'human');
  assert.equal(rolesFromHumanOverride(attachments, {
    siAttachmentReference: 'a.txt', blAttachmentReference: 'a.txt'
  }).valid, false);
});

test('normalizes human field corrections without modifying other extracted fields', () => {
  const fields = { shipper: { rawValue: 'Existing', normalizedValue: 'EXISTING', method: 'alias_rule' } };
  const updated = applyHumanFieldOverrides(fields, 'SI', [{
    documentType: 'SI', field: 'gross_weight_kg', rawValue: '1.25 MT'
  }], 'Confirmed against signed copy');
  assert.equal(updated.shipper.rawValue, 'Existing');
  assert.equal(updated.gross_weight_kg.normalizedValue, 1250);
  assert.equal(updated.gross_weight_kg.method, 'human');
});

test('builds run counter deltas when review resolution changes the outcome', () => {
  assert.deepEqual(outcomeCounterDelta('NEEDS_REVIEW', 'OK'), {
    'counts.review': -1, 'counts.ok': 1
  });
  assert.deepEqual(outcomeCounterDelta('OK', 'OK'), {});
});

test('upserts an open review case with an immutable processing attempt', async () => {
  let call;
  const reviewModel = {
    async findOneAndUpdate(filter, update, options) { call = { filter, update, options }; return call; }
  };
  await syncReviewCase({
    runId: 'run-1', emailId: 'email_001',
    result: { status: 'NEEDS_REVIEW', reviewReason: 'missing_value' }
  }, reviewModel);
  assert.deepEqual(call.filter, { runId: 'run-1', emailId: 'email_001' });
  assert.equal(call.update.$set.stage, 'field');
  assert.equal(call.update.$set.status, 'open');
  assert.equal(call.update.$inc.__v, 1);
  assert.equal(call.options.upsert, true);
});

test('closes an open review automatically when reprocessing resolves it', async () => {
  let call;
  const reviewModel = {
    async findOneAndUpdate(filter, update, options) { call = { filter, update, options }; return call; }
  };
  await syncReviewCase({
    runId: 'run-1', emailId: 'email_001',
    result: { status: 'OK', reviewReason: null, defectFields: [] }
  }, reviewModel);
  assert.deepEqual(call.filter, { runId: 'run-1', emailId: 'email_001', status: 'open' });
  assert.equal(call.update.$set.status, 'resolved');
  assert.equal(call.update.$set.resolution.action, 'reprocessed');
  assert.equal(call.update.$inc.__v, 1);
});

test('resolving a missing value reruns comparison without changing raw source', async () => {
  const source = (await repository.listEmails()).find(({ email_id: emailId }) => emailId === 'email_516');
  const inspected = await Promise.all(source.attachments.map((reference) => repository.inspectAttachment(reference)));
  const phrase = source.subject;
  const initial = await processEmail({ ...source, attachments: inspected }, repository, {
    phraseEntries: [{
      target: 'BL_COMPARISON', phrase, normalizedPhrase: normalizePhrase(phrase),
      tokenCount: phrase.split(/\s+/).length, weight: 10, status: 'seed', allowedLocations: ['subject']
    }],
    documentFieldAi: async () => { throw Object.assign(new Error('disabled'), { code: 'AI_NOT_CONFIGURED' }); }
  });
  assert.equal(initial.result.reviewReason, 'missing_value');
  const persistedEmail = {
    emailId: source.email_id,
    sourceHash: source.sourceHash,
    source: { from: source.from, subject: source.subject, body: source.body, attachments: initial.attachments },
    classification: initial.classification,
    documents: initial.documents,
    result: initial.result,
    lastRunId: 'run-1'
  };
  let emailWrite;
  const emailModel = {
    findOne: () => query(persistedEmail),
    async updateOne(filter, update) { emailWrite = { filter, update }; }
  };
  const reviewModel = {
    findOne: () => query({
      reviewId: 'review-1', runId: 'run-1', emailId: source.email_id,
      status: 'open', __v: 0
    }),
    findOneAndUpdate: (_filter, _update) => query({ reviewId: 'review-1', status: 'resolved', __v: 1 }),
    async updateOne() {}
  };
  const result = await resolveReview('review-1', {
    action: 'correct', preview: false, expectedVersion: 0,
    note: 'Confirmed against the signed SI', reviewer: 'tester',
    corrections: { fields: [{ documentType: 'SI', field: 'gross_weight_kg', rawValue: '235,550 KG' }] }
  }, {
    reviewModel,
    emailModel,
    runModel: { async updateOne() {} },
    auditModel: { async create() {} },
    metricsRefresher: async () => {},
    repository,
    phraseEntries: []
  });
  assert.equal(result.processed.result.status, 'OK');
  assert.equal(emailWrite.update.$set.reviewOverrides.fields[0].rawValue, '235,550 KG');
  assert.equal(persistedEmail.source.body, source.body);
});

test('rejects a stale review update before reprocessing', async () => {
  await assert.rejects(resolveReview('review-1', {
    action: 'confirm', preview: false, expectedVersion: 2,
    note: 'Confirm the current evidence', reviewer: 'tester'
  }, {
    reviewModel: { findOne: () => query({ reviewId: 'review-1', __v: 3 }) },
    emailModel: { findOne() { throw new Error('email lookup should not run'); } }
  }), (error) => error.code === 'REVIEW_CONFLICT' && error.statusCode === 409);
});

test('reopens a resolved review with an audited optimistic update', async () => {
  let updateCall;
  const events = [];
  const review = {
    reviewId: 'review-1', runId: 'run-1', emailId: 'email_001',
    status: 'resolved', __v: 4, resolution: { action: 'confirm' }
  };
  const reopened = await reopenReview('review-1', {
    expectedVersion: 4, reason: 'New source document received', reviewer: 'tester'
  }, {
    reviewModel: {
      findOne: () => query(review),
      findOneAndUpdate(filter, update, options) {
        updateCall = { filter, update, options };
        return query({ ...review, status: 'open', resolvedAt: null, __v: 5 });
      }
    },
    auditModel: { async create(event) { events.push(event); } },
    metricsRefresher: async () => {}
  });
  assert.equal(reopened.status, 'open');
  assert.deepEqual(updateCall.filter, { reviewId: 'review-1', __v: 4, status: 'resolved' });
  assert.equal(updateCall.update.$inc.__v, 1);
  assert.equal(events[0].eventType, 'review.reopened');
});
