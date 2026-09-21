import { z } from 'zod';
import Email from '../models/Email.js';
import ProcessingRun from '../models/ProcessingRun.js';
import { buildSubmission } from '../services/submissionService.js';
import { metricsForRun } from '../services/metricsService.js';
import { cancelRun, retryRun, startRun } from '../services/runService.js';

const startRunSchema = z.object({
  source: z.literal('bundle').default('bundle')
}).strict();

const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  status: z.enum(['queued', 'running', 'cancelling', 'cancelled', 'completed', 'completed_with_errors', 'failed']).optional()
});

export async function startRunController(req, res) {
  const input = startRunSchema.parse(req.body ?? {});
  const run = await startRun(input);
  res.status(202).json({ data: run, error: null, meta: {} });
}

export async function listRunsController(req, res) {
  const { page, limit, status } = paginationSchema.parse(req.query);
  const filter = status ? { state: status } : {};
  const [runs, total] = await Promise.all([
    ProcessingRun.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    ProcessingRun.countDocuments(filter)
  ]);
  res.json({ data: runs, error: null, meta: { page, limit, total } });
}

export async function getRunController(req, res) {
  const run = await ProcessingRun.findOne({ runId: req.params.runId }).lean();
  if (!run) return res.status(404).json({ data: null, error: { code: 'RUN_NOT_FOUND', message: 'Run not found', retryable: false }, meta: {} });
  return res.json({ data: run, error: null, meta: {} });
}

export async function retryRunController(req, res) {
  const run = await retryRun(req.params.runId);
  if (!run) return res.status(404).json({ data: null, error: { code: 'RUN_NOT_FOUND', message: 'Run not found', retryable: false }, meta: {} });
  return res.status(202).json({ data: run, error: null, meta: {} });
}

export async function exportSubmissionController(req, res) {
  const run = await ProcessingRun.findOne({ runId: req.params.runId }).lean();
  if (!run) return res.status(404).json({ data: null, error: { code: 'RUN_NOT_FOUND', message: 'Run not found', retryable: false }, meta: {} });
  if (!['completed', 'completed_with_errors'].includes(run.state)) {
    return res.status(409).json({ data: null, error: { code: 'RUN_NOT_EXPORTABLE', message: 'Run has not completed', retryable: true }, meta: {} });
  }

  const emails = await Email.find({ emailId: { $in: run.emailIds } }).lean({ flattenMaps: true });
  try {
    const submission = buildSubmission(
      emails.map((email) => ({ emailId: email.emailId, ...email.result })),
      run.emailIds
    );
    return res.json(submission);
  } catch (error) {
    return res.status(409).json({
      data: null,
      error: { code: 'SUBMISSION_INVALID', message: error.message, retryable: false },
      meta: {}
    });
  }
}

export async function getRunMetricsController(req, res) {
  const run = await ProcessingRun.findOne({ runId: req.params.runId }).lean();
  if (!run) return res.status(404).json({ data: null, error: { code: 'RUN_NOT_FOUND', message: 'Run not found', retryable: false }, meta: {} });
  const metrics = await metricsForRun(run);
  return res.json({ data: metrics, error: null, meta: { runId: run.runId } });
}

export async function cancelRunController(req, res) {
  const run = await cancelRun(req.params.runId);
  if (!run) return res.status(404).json({ data: null, error: { code: 'RUN_NOT_FOUND', message: 'Run not found', retryable: false }, meta: {} });
  return res.json({ data: run, error: null, meta: {} });
}
