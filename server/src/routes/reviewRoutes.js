import express from 'express';
import {
  getReviewController,
  listReviewsController,
  reopenReviewController,
  resolveReviewController
} from '../controllers/reviewController.js';

const router = express.Router();

router.get('/', listReviewsController);
router.get('/:reviewId', getReviewController);
router.patch('/:reviewId', resolveReviewController);
router.post('/:reviewId/reopen', reopenReviewController);

export default router;
