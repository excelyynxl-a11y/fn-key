import express from 'express';
import {
  getReviewController,
  listReviewsController,
  resolveReviewController
} from '../controllers/reviewController.js';

const router = express.Router();

router.get('/', listReviewsController);
router.get('/:reviewId', getReviewController);
router.patch('/:reviewId', resolveReviewController);

export default router;
