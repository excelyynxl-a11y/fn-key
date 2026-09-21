import { randomUUID } from 'node:crypto';
import { PIPELINE_VERSION } from '../constants/challenge.js';
import Email from '../models/Email.js';
import ProcessingRun from '../models/ProcessingRun.js';
import { createDatasetRepository } from '../repositories/datasetRepository.js';
import { defaultDatasetPath, importDataset } from './inboxService.js';
import { processEmail } from './pipelineService.js';

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

function counterIncrement(processed) {
  return {
    'counts.queued': -1,
    'counts.processed': 1,
    'counts.classified': 1,
    'counts.compared': processed.result.category === 'BL_COMPARISON' ? 1 : 0,
    'counts.mismatched': processed.result.status === 'MISMATCH' ? 1 : 0,
    'counts.review': processed.result.status === 'NEEDS_REVIEW' ? 1 : 0
  };
}

async function processOneEmail(email, repository, runId) {
  await Email.updateOne(
    { emailId: email.emailId },
    { $set: { processingState: 'processing', lastRunId: runId } }
  );

  try {
    const processed = await processEmail(email, repository);
    await Email.updateOne({ emailId: email.emailId }, {
      $set: {
        processingState: 'completed',
        classification: processed.classification,
        documents: processed.documents,
        result: processed.result,
        failure: { code: null, message: null, retryable: false },
        lastRunId: runId,
        pipelineVersion: PIPELINE_VERSION
      }
    });
    await ProcessingRun.updateOne(
      { runId },
      { $inc: counterIncrement(processed) }
    );
  } catch (error) {
    const safeMessage = error instanceof Error ? error.message : 'Unknown processing error';
    await Email.updateOne({ emailId: email.emailId }, {
      $set: {
        processingState: 'failed',
        failure: { code: 'PROCESSING_FAILED', message: safeMessage, retryable: true },
        lastRunId: runId
      }
    });
    await ProcessingRun.updateOne({ runId }, {
      $inc: { 'counts.queued': -1, 'counts.failed': 1 },
      $push: { runErrors: { emailId: email.emailId, code: 'PROCESSING_FAILED', message: safeMessage } }
    });
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
          processed: 0,
          classified: 0,
          compared: 0,
          mismatched: 0,
          review: 0,
          failed: 0
        },
        runErrors: [],
        startedAt: new Date(),
        completedAt: null
      }
    });

    const repository = createDatasetRepository(defaultDatasetPath());
    const concurrency = Number.parseInt(process.env.PROCESSING_CONCURRENCY ?? '4', 10);
    await runWithConcurrency(emails, Number.isInteger(concurrency) ? concurrency : 4, (email) => (
      processOneEmail(email, repository, runId)
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
