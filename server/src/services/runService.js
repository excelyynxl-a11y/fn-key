import { randomUUID } from 'node:crypto';
import { PIPELINE_VERSION } from '../constants/challenge.js';
import Email from '../models/Email.js';
import AuditEvent from '../models/AuditEvent.js';
import ProcessingRun from '../models/ProcessingRun.js';
import { createDatasetRepository } from '../repositories/datasetRepository.js';
import { defaultDatasetPath, importDataset } from './inboxService.js';
import { loadActiveEmailPhrases, recordKnowledgeUsage, seedEmailCategoryPhrases } from './phraseKnowledgeService.js';
import { seedDocumentKnowledge } from './knowledgeService.js';
import { processEmail } from './pipelineService.js';
import { syncReviewCase } from './reviewService.js';

const activeRuns = new Set();

export async function runWithConcurrency(items, concurrency, worker) {
  let nextIndex = 0;
  const workerCount = Math.min(Math.max(1, concurrency), items.length);
  await Promise.all(Array.from({ length: workerCount }, async () => {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      await worker(items[currentIndex], currentIndex);
    }
  }));
}

export function counterIncrement(processed) {
  const aiFallbacks = Object.values(processed.telemetry?.aiFallbacks ?? {}).reduce((sum, value) => sum + value, 0);
  const cacheHits = Object.values(processed.telemetry?.cacheHits ?? {}).reduce((sum, value) => sum + value, 0);
  return {
    'counts.processing': -1,
    'counts.processed': 1,
    'counts.classified': 1,
    'counts.ruleClassified': processed.classification.method === 'rule' ? 1 : 0,
    'counts.aiClassified': processed.classification.method === 'ai' ? 1 : 0,
    'counts.aiCacheHits': cacheHits,
    'counts.aiFallbacks': aiFallbacks,
    'counts.compared': processed.result.category === 'BL_COMPARISON' ? 1 : 0,
    'counts.ok': processed.result.status === 'OK' ? 1 : 0,
    'counts.mismatched': processed.result.status === 'MISMATCH' ? 1 : 0,
    'counts.review': processed.result.status === 'NEEDS_REVIEW' ? 1 : 0
  };
}

export function estimatedAiCost(usage = {}, {
  inputPerMillion = Number(process.env.OPENAI_INPUT_COST_PER_MILLION ?? 0),
  outputPerMillion = Number(process.env.OPENAI_OUTPUT_COST_PER_MILLION ?? 0)
} = {}) {
  return Number((
    Number(usage.inputTokens ?? 0) * inputPerMillion / 1_000_000
    + Number(usage.outputTokens ?? 0) * outputPerMillion / 1_000_000
  ).toFixed(8));
}

async function processOneEmail(email, repository, runId, classificationOptions, { retry = false } = {}) {
  await Email.updateOne(
    { emailId: email.emailId },
    { $set: { processingState: 'processing', lastRunId: runId } }
  );
  await ProcessingRun.updateOne(
    { runId },
    { $inc: { 'counts.queued': -1, 'counts.processing': 1 } }
  );

  try {
    const processingStartedAt = Date.now();
    await AuditEvent.create({
      eventType: retry ? 'email.retry.started' : 'email.processing.started',
      entityType: 'email',
      entityId: email.emailId,
      runId,
      emailId: email.emailId,
      details: { retry }
    });
    const processed = await processEmail(email, repository, classificationOptions);
    const durationMs = Date.now() - processingStartedAt;
    const estimatedCostUsd = estimatedAiCost(processed.telemetry?.usage);
    await recordKnowledgeUsage(processed.classification.matchedEvidence);
    await syncReviewCase({ runId, emailId: email.emailId, result: processed.result });
    await AuditEvent.create({
      eventType: 'email.processing.completed',
      entityType: 'email',
      entityId: email.emailId,
      runId,
      emailId: email.emailId,
      details: {
        retry,
        category: processed.classification.category,
        classificationMethod: processed.classification.method,
        classificationCacheHit: processed.classification.cacheHit ?? false,
        documentRoleMethods: [processed.documents?.si?.roleMethod, processed.documents?.bl?.roleMethod].filter(Boolean),
        fieldMethods: [...new Set(Object.values(processed.documents ?? {}).flatMap((document) => (
          Object.values(document?.fields ?? {}).map(({ method }) => method).filter(Boolean)
        )))],
        status: processed.result.status,
        reviewReason: processed.result.reviewReason
      }
    });
    await Email.updateOne({ emailId: email.emailId }, {
      $set: {
        processingState: 'completed',
        'source.attachments': processed.attachments,
        classification: processed.classification,
        documents: processed.documents,
        result: processed.result,
        'metrics.durationMs': durationMs,
        'metrics.aiFallbacks': processed.telemetry?.aiFallbacks ?? {},
        'metrics.cacheHits': processed.telemetry?.cacheHits ?? {},
        'metrics.usage': processed.telemetry?.usage ?? {},
        'metrics.estimatedCostUsd': estimatedCostUsd,
        failure: { code: null, message: null, retryable: false },
        lastRunId: runId,
        pipelineVersion: PIPELINE_VERSION
      },
      $inc: { 'metrics.processingAttempts': 1 }
    });
    await ProcessingRun.updateOne(
      { runId },
      { $inc: counterIncrement(processed) }
    );
  } catch (error) {
    const safeMessage = error instanceof Error ? error.message : 'Unknown processing error';
    const errorCode = error?.code ?? 'PROCESSING_FAILED';
    await Email.updateOne({ emailId: email.emailId }, {
      $set: {
        processingState: 'failed',
        failure: { code: errorCode, message: safeMessage, retryable: error?.retryable ?? true },
        lastRunId: runId
      }
    });
    await ProcessingRun.updateOne({ runId }, {
      $inc: { 'counts.processing': -1, 'counts.failed': 1 },
      $push: { runErrors: { emailId: email.emailId, code: errorCode, message: safeMessage } }
    });
    await AuditEvent.create({
      eventType: 'email.processing.failed',
      entityType: 'email',
      entityId: email.emailId,
      runId,
      emailId: email.emailId,
      details: { retry, code: errorCode, message: safeMessage }
    }).catch(() => {});
  }
}

export async function executeRun(runId, { retryOnly = false } = {}) {
  if (activeRuns.has(runId)) throw new Error(`Run ${runId} is already active`);
  activeRuns.add(runId);

  try {
    const run = await ProcessingRun.findOne({ runId }).lean();
    if (!run) throw new Error(`Run ${runId} was not found`);

    let emailIds = run.emailIds;
    if (!retryOnly || emailIds.length === 0) {
      const imported = await importDataset({ runId });
      emailIds = imported.emailIds;
    }

    const query = { emailId: { $in: emailIds } };
    if (retryOnly) {
      query.$or = [
        { processingState: 'failed' },
        { 'result.status': 'NEEDS_REVIEW' }
      ];
    }
    const emails = await Email.find(query).sort({ emailId: 1 }).lean({ flattenMaps: true });

    await ProcessingRun.updateOne({ runId }, {
      $set: {
        state: 'running',
        emailIds,
        counts: {
          total: emails.length,
          queued: emails.length,
          processing: 0,
          processed: 0,
          classified: 0,
          ruleClassified: 0,
          aiClassified: 0,
          aiCacheHits: 0,
          compared: 0,
          ok: 0,
          mismatched: 0,
          review: 0,
          aiFallbacks: 0,
          failed: 0
        },
        runErrors: [],
        startedAt: new Date(),
        completedAt: null
      }
    });

    await seedEmailCategoryPhrases();
    await seedDocumentKnowledge();
    const phraseEntries = await loadActiveEmailPhrases();
    const repository = createDatasetRepository(defaultDatasetPath());
    const concurrency = Number.parseInt(process.env.PROCESSING_CONCURRENCY ?? '4', 10);
    await runWithConcurrency(emails, Number.isInteger(concurrency) ? concurrency : 4, (email) => (
      processOneEmail(email, repository, runId, { phraseEntries }, { retry: retryOnly })
    ));

    const completedRun = await ProcessingRun.findOne({ runId }).lean();
    await ProcessingRun.updateOne({ runId }, {
      $set: {
        state: completedRun.counts.failed > 0 ? 'completed_with_errors' : 'completed',
        completedAt: new Date()
      }
    });
  } catch (error) {
    await ProcessingRun.updateOne({ runId }, {
      $set: { state: 'failed', completedAt: new Date() },
      $push: {
        runErrors: {
          emailId: null,
          code: 'RUN_FAILED',
          message: error instanceof Error ? error.message : 'Unknown run error'
        }
      }
    });
    throw error;
  } finally {
    activeRuns.delete(runId);
  }
}

function launchRun(runId, options) {
  setImmediate(() => {
    executeRun(runId, options).catch((error) => {
      console.error(`Run ${runId} failed:`, error.message);
    });
  });
}

export async function startRun({ source = 'bundle' } = {}) {
  const runId = randomUUID();
  const run = await ProcessingRun.create({
    runId,
    source,
    state: 'queued',
    pipelineVersion: PIPELINE_VERSION
  });
  launchRun(runId, { retryOnly: false });
  return run.toObject();
}

export async function retryRun(runId) {
  const run = await ProcessingRun.findOne({ runId });
  if (!run) return null;
  if (activeRuns.has(runId) || ['queued', 'running'].includes(run.state)) {
    const error = new Error('Run is already active');
    error.statusCode = 409;
    throw error;
  }
  run.state = 'queued';
  await run.save();
  launchRun(runId, { retryOnly: true });
  return run.toObject();
}
