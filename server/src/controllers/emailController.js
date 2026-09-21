import { z } from 'zod';
import Email from '../models/Email.js';
import { COMPARISON_STATUSES, EMAIL_CATEGORIES } from '../constants/challenge.js';

const listEmailSchema = z.object({
  runId: z.string().min(1),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  category: z.enum(EMAIL_CATEGORIES).optional(),
  status: z.enum(COMPARISON_STATUSES).optional(),
  search: z.string().trim().max(200).optional()
});

export async function listEmailsController(req, res) {
  const { runId, page, limit, category, status, search } = listEmailSchema.parse(req.query);
  const filter = { lastRunId: runId };
  if (category) filter['result.category'] = category;
  if (status) filter['result.status'] = status;
  if (search) {
    const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.$or = [
      { emailId: { $regex: escapedSearch, $options: 'i' } },
      { 'source.subject': { $regex: escapedSearch, $options: 'i' } },
      { 'source.from': { $regex: escapedSearch, $options: 'i' } }
    ];
  }

  const [emails, total] = await Promise.all([
    Email.find(filter)
      .select('emailId source.from source.subject source.attachments.filename processingState classification result updatedAt')
      .sort({ emailId: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean({ flattenMaps: true }),
    Email.countDocuments(filter)
  ]);
  res.json({ data: emails, error: null, meta: { page, limit, total } });
}

export async function getEmailController(req, res) {
  const email = await Email.findOne({ emailId: req.params.emailId }).lean({ flattenMaps: true });
  if (!email) return res.status(404).json({ data: null, error: { code: 'EMAIL_NOT_FOUND', message: 'Email not found', retryable: false }, meta: {} });
  return res.json({ data: email, error: null, meta: {} });
}
