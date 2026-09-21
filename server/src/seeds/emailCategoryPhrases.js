import { KNOWLEDGE_VERSION } from '../constants/challenge.js';

function phrase(target, value, weight, locations = ['subject', 'body']) {
  return {
    kind: 'email_category',
    target,
    phrase: value,
    weight,
    allowedLocations: locations,
    status: 'seed',
    source: 'team_seed',
    sourceVersion: KNOWLEDGE_VERSION
  };
}

export const EMAIL_CATEGORY_SEEDS = Object.freeze([
  phrase('BL_COMPARISON', 'attached are the si and draft bl', 8, ['body']),
  phrase('BL_COMPARISON', 'shipping instruction and the draft bill of lading', 8, ['body']),
  phrase('BL_COMPARISON', 'verify the bl matches the si', 8, ['body']),
  phrase('BL_COMPARISON', 'check the details and confirm', 5, ['body']),
  phrase('BL_COMPARISON', 'to confirm docs', 5, ['subject']),
  phrase('BL_COMPARISON', 'request bl draft', 5, ['subject']),

  phrase('SI_REQUEST', 'please find shipping instruction', 7, ['body']),
  phrase('SI_REQUEST', 'please revert with draft bl once available', 7, ['body']),
  phrase('SI_REQUEST', 'request si', 6, ['subject']),
  phrase('SI_REQUEST', 'si needed', 6, ['subject']),
  phrase('SI_REQUEST', 'cust si', 5, ['subject']),
  phrase('SI_REQUEST', 'prepare shipping instruction', 7),
  phrase('SI_REQUEST', 'create shipping instruction', 7),

  phrase('INVOICE_QUERY', 'query on invoice', 8, ['body']),
  phrase('INVOICE_QUERY', 'local charge included or billed separately', 8, ['body']),
  phrase('INVOICE_QUERY', 'please advise the breakdown', 6, ['body']),
  phrase('INVOICE_QUERY', 'local charges', 5, ['subject']),
  phrase('INVOICE_QUERY', 'request to cancel invoice', 7, ['subject']),
  phrase('INVOICE_QUERY', 'total freight', 5, ['subject']),
  phrase('INVOICE_QUERY', 'missing gr', 5, ['subject']),
  phrase('INVOICE_QUERY', 'mill d & d charges', 6, ['subject']),

  phrase('SPAM', 'claim your prize', 9),
  phrase('SPAM', 'limited time offer', 8),
  phrase('SPAM', 'you have won', 8),
  phrase('SPAM', 'bank details to proceed', 8, ['body']),
  phrase('SPAM', 'guaranteed 300% returns', 9),
  phrase('SPAM', 'verify your account within 24 hours', 8, ['body']),
  phrase('SPAM', 'unpaid customs fee', 8, ['body']),
  phrase('SPAM', 'one weird trick', 8),
  phrase('SPAM', 'avoid suspension', 6),

  phrase('GENERAL', 'no action required', 6, ['body']),
  phrase('GENERAL', 'daily berthing report', 7),
  phrase('GENERAL', 'update summary', 5, ['subject', 'body']),
  phrase('GENERAL', 'loading completed', 5, ['body']),
  phrase('GENERAL', 'delivery planning', 6, ['subject']),
  phrase('GENERAL', 'pending bl release', 6, ['subject']),
  phrase('GENERAL', 'outstanding bl', 5, ['subject', 'body']),
  phrase('GENERAL', 'time off request', 7, ['subject']),
  phrase('GENERAL', 'office resumes normal operations', 6, ['body']),
  phrase('GENERAL', 'miss connection', 5, ['subject'])
]);
