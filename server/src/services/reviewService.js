import { randomUUID } from 'node:crypto';
import AuditEvent from '../models/AuditEvent.js';
import Email from '../models/Email.js';
import ProcessingRun from '../models/ProcessingRun.js';
import ReviewCase from '../models/ReviewCase.js';
import { createDatasetRepository } from '../repositories/datasetRepository.js';
import { defaultDatasetPath } from './inboxService.js';
import { loadActiveEmailPhrases } from './phraseKnowledgeService.js';
import { learnClassificationPhrases } from './learningService.js';
import { estimatedAiCost, refreshRunMetrics } from './metricsService.js';
import { processEmail } from './pipelineService.js';

export function reviewStageForReason(reviewReason) {
  return ({
    missing_attachment: 'attachment',
    unreadable: 'readability',
    wrong_doc_type: 'document_role',
    missing_value: 'field'
  })[reviewReason];
}

function reviewConflict(message = 'Review changed since it was loaded') {
  const error = new Error(message);
  error.code = 'REVIEW_CONFLICT';
  error.statusCode = 409;
  error.retryable = true;
  return error;
}

export async function syncReviewCase({ runId, emailId, result }, reviewModel = ReviewCase) {
  const attempt = {
    at: new Date(),
    status: result.status,
    reviewReason: result.reviewReason
  };
  if (result.status !== 'NEEDS_REVIEW') {
    return reviewModel.findOneAndUpdate(
      { runId, emailId, status: 'open' },
      {
        $set: {
          status: 'resolved', resolvedAt: new Date(),
          resolution: { action: 'reprocessed', nextResult: result }
        },
        $push: { attempts: attempt },
        $inc: { __v: 1 }
      },
      { new: true }
    );
  }
  return reviewModel.findOneAndUpdate(
    { runId, emailId },
    {
      $setOnInsert: { reviewId: randomUUID(), runId, emailId },
      $set: {
        reviewReason: result.reviewReason,
        stage: reviewStageForReason(result.reviewReason),
        status: 'open',
        resolvedAt: null
      },
      $push: { attempts: attempt },
      $inc: { __v: 1 }
    },
    { upsert: true, new: true }
  );
}

function mergeCorrections(existing = {}, corrections = {}, note, reviewer) {
  const fields = new Map((existing.fields ?? []).map((entry) => (
    [`${entry.documentType}:${entry.field}`, entry]
  )));
  for (const entry of corrections.fields ?? []) fields.set(`${entry.documentType}:${entry.field}`, entry);
  return {
    category: corrections.category ?? existing.category ?? null,
    roles: corrections.roles ?? existing.roles ?? {
      siAttachmentReference: null, blAttachmentReference: null
    },
    fields: [...fields.values()],
    note,
    updatedBy: reviewer,
    updatedAt: new Date()
  };
}

function outcomeCounter(status) {
  return ({ OK: 'counts.ok', MISMATCH: 'counts.mismatched', NEEDS_REVIEW: 'counts.review' })[status] ?? null;
}

export function outcomeCounterDelta(previousStatus, nextStatus) {
  if (previousStatus === nextStatus) return {};
  const delta = {};
  const previous = outcomeCounter(previousStatus);
  const next = outcomeCounter(nextStatus);
  if (previous) delta[previous] = -1;
  if (next) delta[next] = (delta[next] ?? 0) + 1;
  return delta;
}

export async function previewReviewCorrection(review, email, corrections, {
  repository = createDatasetRepository(defaultDatasetPath()),
  phraseEntries
} = {}) {
  const reviewOverrides = mergeCorrections(email.reviewOverrides, corrections, corrections.note, corrections.reviewer);
  const activePhrases = phraseEntries ?? await loadActiveEmailPhrases();
  return processEmail({ ...email, reviewOverrides }, repository, {
    phraseEntries: activePhrases,
    reuseClassification: true
  });
}

export async function resolveReview(reviewId, input, {
  reviewModel = ReviewCase,
  emailModel = Email,
  runModel = ProcessingRun,
  auditModel = AuditEvent,
  repository = createDatasetRepository(defaultDatasetPath()),
  phraseEntries,
  metricsRefresher = refreshRunMetrics
} = {}) {
  const review = await reviewModel.findOne({ reviewId }).lean();
  if (!review) return null;
  if (review.__v !== input.expectedVersion) throw reviewConflict();
  const email = await emailModel.findOne({ emailId: review.emailId, lastRunId: review.runId }).lean({ flattenMaps: true });
  if (!email) return null;

  if (input.action === 'confirm') {
    if (!input.preview) {
      const updatedReview = await reviewModel.findOneAndUpdate({
        reviewId,
        __v: input.expectedVersion,
        status: 'open'
      }, {
        $set: {
          status: 'resolved', resolvedAt: new Date(),
          resolution: { action: 'confirm', note: input.note, reviewer: input.reviewer, previousResult: email.result }
        },
        $inc: { __v: 1 }
      }, { new: true }).lean();
      if (!updatedReview) throw reviewConflict();
      await auditModel.create({
        eventType: 'review.confirmed', entityType: 'review', entityId: reviewId,
        runId: review.runId, emailId: review.emailId,
        details: { note: input.note, reviewer: input.reviewer, result: email.result }
      });
      await metricsRefresher(review.runId);
    }
    return { review, preview: email.result, processed: null };
  }

  const processingStartedAt = Date.now();
  const corrections = { ...input.corrections, note: input.note, reviewer: input.reviewer };
  const processed = await previewReviewCorrection(review, email, corrections, { repository, phraseEntries });
  if (input.preview) return { review, preview: processed.result, processed };

  const durationMs = Date.now() - processingStartedAt;
  const estimatedCostUsd = estimatedAiCost(processed.telemetry?.usage);
  const metricsAttempt = {
    trigger: 'review_correction',
    at: new Date(),
    durationMs,
    aiFallbacks: processed.telemetry?.aiFallbacks ?? {},
    cacheHits: processed.telemetry?.cacheHits ?? {},
    usage: processed.telemetry?.usage ?? {},
    estimatedCostUsd
  };

  const reviewOverrides = mergeCorrections(email.reviewOverrides, input.corrections, input.note, input.reviewer);
  const remainsOpen = processed.result.status === 'NEEDS_REVIEW';
  const updatedReview = await reviewModel.findOneAndUpdate({
    reviewId,
    __v: input.expectedVersion,
    status: 'open'
  }, {
    $set: {
      status: remainsOpen ? 'open' : 'resolved',
      resolvedAt: remainsOpen ? null : new Date(),
      resolution: {
        action: 'correct', note: input.note, reviewer: input.reviewer,
        corrections: input.corrections, previousResult: email.result, nextResult: processed.result,
        knowledgeUpdate: input.knowledgeUpdate ?? { enabled: false }
      }
    },
    $inc: { __v: 1 }
  }, { new: true }).lean();
  if (!updatedReview) throw reviewConflict();

  let knowledgeOutcome = null;
  if (input.knowledgeUpdate?.enabled) {
    knowledgeOutcome = await learnClassificationPhrases({
      email: { emailId: email.emailId, subject: email.source.subject, body: email.source.body },
      category: processed.classification.category,
      evidencePhrases: [input.knowledgeUpdate.phrase],
      source: 'human'
    });
  }
  await emailModel.updateOne({ emailId: review.emailId, lastRunId: review.runId }, {
    $set: {
      reviewOverrides,
      'source.attachments': processed.attachments,
      classification: processed.classification,
      documents: processed.documents,
      result: processed.result,
      processingState: 'completed',
      'metrics.durationMs': durationMs,
      'metrics.aiFallbacks': metricsAttempt.aiFallbacks,
      'metrics.cacheHits': metricsAttempt.cacheHits,
      'metrics.usage': metricsAttempt.usage,
      'metrics.estimatedCostUsd': estimatedCostUsd
    },
    $inc: { 'metrics.processingAttempts': 1 },
    $push: { 'metrics.attempts': metricsAttempt }
  });
  const delta = outcomeCounterDelta(email.result?.status, processed.result.status);
  if (Object.keys(delta).length > 0) await runModel.updateOne({ runId: review.runId }, { $inc: delta });
  if (knowledgeOutcome) {
    await reviewModel.updateOne({ reviewId, __v: updatedReview.__v }, {
      $set: { 'resolution.knowledgeOutcome': knowledgeOutcome }
    });
  }
  await auditModel.create({
    eventType: 'review.corrected', entityType: 'review', entityId: reviewId,
    runId: review.runId, emailId: review.emailId,
    details: {
      note: input.note, reviewer: input.reviewer, corrections: input.corrections,
      previousResult: email.result, nextResult: processed.result
    }
  });
  await metricsRefresher(review.runId);
  return { review, preview: processed.result, processed };
}

export async function reopenReview(reviewId, input, {
  reviewModel = ReviewCase,
  auditModel = AuditEvent,
  metricsRefresher = refreshRunMetrics
} = {}) {
  const review = await reviewModel.findOne({ reviewId }).lean();
  if (!review) return null;
  if (review.__v !== input.expectedVersion) throw reviewConflict();
  if (review.status !== 'resolved') throw reviewConflict('Only a resolved review can be reopened');
  const reopened = await reviewModel.findOneAndUpdate({
    reviewId,
    __v: input.expectedVersion,
    status: 'resolved'
  }, {
    $set: { status: 'open', resolvedAt: null },
    $inc: { __v: 1 }
  }, { new: true }).lean();
  if (!reopened) throw reviewConflict();
  await auditModel.create({
    eventType: 'review.reopened', entityType: 'review', entityId: reviewId,
    runId: review.runId, emailId: review.emailId,
    details: { reason: input.reason, reviewer: input.reviewer, previousResolution: review.resolution }
  });
  await metricsRefresher(review.runId);
  return reopened;
}

export async function retryReviewedEmail(emailId, runId, options = {}) {
  const emailModel = options.emailModel ?? Email;
  const reviewModel = options.reviewModel ?? ReviewCase;
  const auditModel = options.auditModel ?? AuditEvent;
  const runModel = options.runModel ?? ProcessingRun;
  const metricsRefresher = options.metricsRefresher ?? refreshRunMetrics;
  const email = await emailModel.findOne({ emailId, lastRunId: runId }).lean({ flattenMaps: true });
  if (!email) return null;
  const processingStartedAt = Date.now();
  const processed = await previewReviewCorrection(null, email, {}, options);
  const durationMs = Date.now() - processingStartedAt;
  const estimatedCostUsd = estimatedAiCost(processed.telemetry?.usage);
  const metricsAttempt = {
    trigger: 'manual_retry',
    at: new Date(),
    durationMs,
    aiFallbacks: processed.telemetry?.aiFallbacks ?? {},
    cacheHits: processed.telemetry?.cacheHits ?? {},
    usage: processed.telemetry?.usage ?? {},
    estimatedCostUsd
  };
  await emailModel.updateOne({ emailId, lastRunId: runId }, {
    $set: {
      'source.attachments': processed.attachments,
      classification: processed.classification,
      documents: processed.documents,
      result: processed.result,
      processingState: 'completed',
      'metrics.durationMs': durationMs,
      'metrics.aiFallbacks': metricsAttempt.aiFallbacks,
      'metrics.cacheHits': metricsAttempt.cacheHits,
      'metrics.usage': metricsAttempt.usage,
      'metrics.estimatedCostUsd': estimatedCostUsd
    },
    $inc: { 'metrics.processingAttempts': 1 },
    $push: { 'metrics.attempts': metricsAttempt }
  });
  const delta = outcomeCounterDelta(email.result?.status, processed.result.status);
  if (Object.keys(delta).length > 0) await runModel.updateOne({ runId }, { $inc: delta });
  await syncReviewCase({ runId, emailId, result: processed.result }, reviewModel);
  await auditModel.create({
    eventType: 'email.retry.completed', entityType: 'email', entityId: emailId,
    runId, emailId, details: { status: processed.result.status, reviewReason: processed.result.reviewReason }
  });
  await metricsRefresher(runId);
  return processed;
}
