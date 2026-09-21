import express from 'express';
import { getEmailController, listEmailsController } from '../controllers/emailController.js';
import { retryEmailController } from '../controllers/reviewController.js';

const router = express.Router();

router.get('/', listEmailsController);
router.post('/:emailId/retry', retryEmailController);
router.get('/:emailId', getEmailController);

export default router;
