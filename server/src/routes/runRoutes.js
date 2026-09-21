import express from 'express';
import {
  exportSubmissionController,
  getRunController,
  listRunsController,
  retryRunController,
  startRunController
} from '../controllers/runController.js';

const router = express.Router();

router.post('/', startRunController);
router.get('/', listRunsController);
router.get('/:runId', getRunController);
router.post('/:runId/retry', retryRunController);
router.get('/:runId/submission', exportSubmissionController);

export default router;

