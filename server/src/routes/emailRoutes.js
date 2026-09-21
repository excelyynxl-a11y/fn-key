import express from 'express';
import { getEmailController, listEmailsController } from '../controllers/emailController.js';

const router = express.Router();

router.get('/', listEmailsController);
router.get('/:emailId', getEmailController);

export default router;
