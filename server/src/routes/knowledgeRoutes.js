import express from 'express';
import {
  knowledgeAuditController,
  listKnowledgeController,
  updateKnowledgeController
} from '../controllers/knowledgeController.js';

const router = express.Router();
router.get('/', listKnowledgeController);
router.get('/audit', knowledgeAuditController);
router.patch('/:id', updateKnowledgeController);
export default router;
