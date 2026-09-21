import express from "express";
import { analyseEmailController } from "../controllers/emailController.js";
import upload from "../middleware/uploadMiddleware.js";

const router = express.Router();

router.post(
  '/analyse',
  upload.single('email'),
  analyseEmailController
);
export default router;