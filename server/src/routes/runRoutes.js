import express from 'express';
import {
  cancelRunController,
  exportSubmissionController,
  getRunController,
  getRunMetricsController,
  listRunsController,
  retryRunController,
  startRunController,
  validateSubmissionController
} from '../controllers/runController.js';

const router = express.Router();

router.post('/', startRunController);
router.get('/', listRunsController);
router.get('/:runId', getRunController);
router.get('/:runId/metrics', getRunMetricsController);
router.post('/:runId/retry', retryRunController);
router.post('/:runId/cancel', cancelRunController);
router.get('/:runId/submission', exportSubmissionController);
router.post('/:runId/submission/validate', validateSubmissionController);

export default router;

