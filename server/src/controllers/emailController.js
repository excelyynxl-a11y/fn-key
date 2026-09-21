import { z } from 'zod';
import Email from '../models/Email.js';
import AuditEvent from '../models/AuditEvent.js';
import ReviewCase from '../models/ReviewCase.js';
import { COMPARISON_STATUSES, EMAIL_CATEGORIES } from '../constants/challenge.js';

const listEmailSchema = z.object({
  runId: z.string().min(1),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  category: z.enum(EMAIL_CATEGORIES).optional(),
  status: z.enum(COMPARISON_STATUSES).optional(),
  reviewReason: z.enum(['wrong_doc_type', 'missing_attachment', 'unreadable', 'missing_value']).optional(),
  fileType: z.enum(['.txt', '.pdf', '.docx', '.xlsx']).optional(),
  method: z.enum(['rule', 'ai', 'human']).optional(),
  processingState: z.enum(['imported', 'queued', 'processing', 'completed', 'failed']).optional(),
  sort: z.enum(['email_asc', 'email_desc', 'updated_desc']).default('email_asc'),
  search: z.string().trim().max(200).optional()
});

const getEmailSchema = z.object({ runId: z.string().min(1) });

const sortOptions = {
  email_asc: { emailId: 1 },
  email_desc: { emailId: -1 },
  updated_desc: { updatedAt: -1, emailId: 1 }
};

function countsByValue(rows) {
  return Object.fromEntries(rows.map(({ _id, count }) => [_id ?? 'unassigned', count]));
}

export async function listEmailsController(req, res) {
  const {
    runId, page, limit, category, status, reviewReason, fileType,
    method, processingState, sort, search
  } = listEmailSchema.parse(req.query);
  const filter = { lastRunId: runId };
  if (category) filter['result.category'] = category;
  if (status) filter['result.status'] = status;
  if (reviewReason) filter['result.reviewReason'] = reviewReason;
  if (fileType) filter['source.attachments.extension'] = fileType;
  if (method) filter['classification.method'] = method;
  if (processingState) filter.processingState = processingState;
  if (search) {
    const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.$or = [
      { emailId: { $regex: escapedSearch, $options: 'i' } },
      { 'source.subject': { $regex: escapedSearch, $options: 'i' } },
      { 'source.from': { $regex: escapedSearch, $options: 'i' } }
    ];
  }

  const [emails, total, totals] = await Promise.all([
    Email.find(filter)
      .select('emailId source.from source.subject source.attachments.filename processingState classification result updatedAt')
      .sort(sortOptions[sort])
      .skip((page - 1) * limit)
      .limit(limit)
      .lean({ flattenMaps: true }),
    Email.countDocuments(filter),
    Email.aggregate([
      { $match: { lastRunId: runId } },
      {
        $facet: {
          categories: [{ $group: { _id: '$result.category', count: { $sum: 1 } } }],
          statuses: [{ $group: { _id: '$result.status', count: { $sum: 1 } } }],
          methods: [{ $group: { _id: '$classification.method', count: { $sum: 1 } } }],
          processingStates: [{ $group: { _id: '$processingState', count: { $sum: 1 } } }]
        }
      }
    ])
  ]);
  const facets = totals[0] ?? {};
  res.json({
    data: emails,
    error: null,
    meta: {
      page,
      limit,
      total,
      filterTotals: {
        categories: countsByValue(facets.categories ?? []),
        statuses: countsByValue(facets.statuses ?? []),
        methods: countsByValue(facets.methods ?? []),
        processingStates: countsByValue(facets.processingStates ?? [])
      }
    }
  });
}

export async function getEmailController(req, res) {
  const { runId } = getEmailSchema.parse(req.query);
  const [email, timeline, review] = await Promise.all([
    Email.findOne({ emailId: req.params.emailId, lastRunId: runId }).lean({ flattenMaps: true }),
    AuditEvent.find({ emailId: req.params.emailId }).sort({ createdAt: 1 }).lean(),
    ReviewCase.findOne({ emailId: req.params.emailId, runId }).lean({ flattenMaps: true })
  ]);
  if (!email) return res.status(404).json({ data: null, error: { code: 'EMAIL_NOT_FOUND', message: 'Email not found', retryable: false }, meta: {} });
  return res.json({ data: { ...email, timeline, review }, error: null, meta: {} });
}
