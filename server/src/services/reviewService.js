import { randomUUID } from 'node:crypto';
import AuditEvent from '../models/AuditEvent.js';
import Email from '../models/Email.js';
import ProcessingRun from '../models/ProcessingRun.js';
import ReviewCase from '../models/ReviewCase.js';
import { createDatasetRepository } from '../repositories/datasetRepository.js';
import { defaultDatasetPath } from './inboxService.js';
import { loadActiveEmailPhrases } from './phraseKnowledgeService.js';
import { processEmail } from './pipelineService.js';

export function reviewStageForReason(reviewReason) {
  return ({
    missing_attachment: 'attachment',
    unreadable: 'readability',
    wrong_doc_type: 'document_role',
    missing_value: 'field'
  })[reviewReason];
}

export async function syncReviewCase({ runId, emailId, result }, reviewModel = ReviewCase) {
  if (result.status !== 'NEEDS_REVIEW') return null;
  const attempt = {
    at: new Date(),
    status: result.status,
    reviewReason: result.reviewReason
  };
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
      $push: { attempts: attempt }
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
  phraseEntries
} = {}) {
  const review = await reviewModel.findOne({ reviewId }).lean();
  if (!review) return null;
  const email = await emailModel.findOne({ emailId: review.emailId, lastRunId: review.runId }).lean({ flattenMaps: true });
  if (!email) return null;

  if (input.action === 'confirm') {
    if (!input.preview) {
      await reviewModel.updateOne({ reviewId }, {
        $set: {
          status: 'resolved', resolvedAt: new Date(),
          resolution: { action: 'confirm', note: input.note, reviewer: input.reviewer, previousResult: email.result }
        }
      });
      await auditModel.create({
        eventType: 'review.confirmed', entityType: 'review', entityId: reviewId,
        runId: review.runId, emailId: review.emailId,
        details: { note: input.note, reviewer: input.reviewer, result: email.result }
      });
    }
    return { review, preview: email.result, processed: null };
  }

  const corrections = { ...input.corrections, note: input.note, reviewer: input.reviewer };
  const processed = await previewReviewCorrection(review, email, corrections, { repository, phraseEntries });
  if (input.preview) return { review, preview: processed.result, processed };

  const reviewOverrides = mergeCorrections(email.reviewOverrides, input.corrections, input.note, input.reviewer);
  await emailModel.updateOne({ emailId: review.emailId, lastRunId: review.runId }, {
    $set: {
      reviewOverrides,
      'source.attachments': processed.attachments,
      classification: processed.classification,
      documents: processed.documents,
      result: processed.result,
      processingState: 'completed'
    }
  });
  const delta = outcomeCounterDelta(email.result?.status, processed.result.status);
  if (Object.keys(delta).length > 0) await runModel.updateOne({ runId: review.runId }, { $inc: delta });
  const remainsOpen = processed.result.status === 'NEEDS_REVIEW';
  await reviewModel.updateOne({ reviewId }, {
    $set: {
      status: remainsOpen ? 'open' : 'resolved',
      resolvedAt: remainsOpen ? null : new Date(),
      resolution: {
        action: 'correct', note: input.note, reviewer: input.reviewer,
        corrections: input.corrections, previousResult: email.result, nextResult: processed.result,
        knowledgeUpdate: input.knowledgeUpdate ?? { enabled: false }
      }
    }
  });
  await auditModel.create({
    eventType: 'review.corrected', entityType: 'review', entityId: reviewId,
    runId: review.runId, emailId: review.emailId,
    details: {
      note: input.note, reviewer: input.reviewer, corrections: input.corrections,
      previousResult: email.result, nextResult: processed.result
    }
  });
  return { review, preview: processed.result, processed };
}

export async function retryReviewedEmail(emailId, runId, options = {}) {
  const emailModel = options.emailModel ?? Email;
  const reviewModel = options.reviewModel ?? ReviewCase;
  const auditModel = options.auditModel ?? AuditEvent;
  const runModel = options.runModel ?? ProcessingRun;
  const email = await emailModel.findOne({ emailId, lastRunId: runId }).lean({ flattenMaps: true });
  if (!email) return null;
  const processed = await previewReviewCorrection(null, email, {}, options);
  await emailModel.updateOne({ emailId, lastRunId: runId }, {
    $set: {
      'source.attachments': processed.attachments,
      classification: processed.classification,
      documents: processed.documents,
      result: processed.result,
      processingState: 'completed'
    }
  });
  const delta = outcomeCounterDelta(email.result?.status, processed.result.status);
  if (Object.keys(delta).length > 0) await runModel.updateOne({ runId }, { $inc: delta });
  if (processed.result.status === 'NEEDS_REVIEW') {
    await syncReviewCase({ runId, emailId, result: processed.result }, reviewModel);
  } else {
    await reviewModel.updateOne({ runId, emailId, status: 'open' }, {
      $set: {
        status: 'resolved', resolvedAt: new Date(),
        resolution: { action: 'retry', nextResult: processed.result }
      },
      $push: { attempts: { at: new Date(), status: processed.result.status, reviewReason: null } }
    });
  }
  await auditModel.create({
    eventType: 'email.retry.completed', entityType: 'email', entityId: emailId,
    runId, emailId, details: { status: processed.result.status, reviewReason: processed.result.reviewReason }
  });
  return processed;
}
