import { z } from 'zod';
import { EMAIL_CATEGORIES } from '../constants/challenge.js';

export const aiEmailClassificationSchema = z.object({
  category: z.enum(EMAIL_CATEGORIES),
  reason: z.string().trim().min(1).max(400),
  evidencePhrases: z.array(z.string().trim().min(2).max(200)).min(1).max(5),
  confidence: z.number().min(0).max(1)
}).strict();
