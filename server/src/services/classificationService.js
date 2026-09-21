const CATEGORY_RULES = [
  {
    category: 'INVOICE_QUERY',
    phrases: ['invoice', 'local charge', 'billed separately', 'thc charge', 'invoice breakdown']
  },
  {
    category: 'SI_REQUEST',
    phrases: ['prepare shipping instruction', 'prepare the si', 'create shipping instruction', 'send the si', 'new si request']
  },
  {
    category: 'SPAM',
    phrases: ['unsubscribe', 'limited time offer', 'claim your prize', 'exclusive promotion']
  },
  {
    category: 'BL_COMPARISON',
    phrases: [
      'attached are the si and draft bl',
      'shipping instruction and the draft bill of lading',
      'verify the bl matches the si',
      'confirm docs',
      'check the details and confirm',
      'draft bl for checking',
      'draft bill of lading for your confirmation'
    ]
  }
];

function normalizeMessage(value) {
  return value.normalize('NFKC').toLowerCase().replace(/[_\s]+/g, ' ').trim();
}

export function classifyEmailByRules(email) {
  const subject = normalizeMessage(email.subject ?? '');
  const body = normalizeMessage(email.body ?? '');
  const combined = `${subject}\n${body}`;

  for (const rule of CATEGORY_RULES) {
    const evidencePhrases = rule.phrases.filter((phrase) => combined.includes(phrase));
    if (evidencePhrases.length > 0) {
      return {
        category: rule.category,
        method: 'rule',
        confidence: evidencePhrases.length > 1 ? 0.98 : 0.9,
        reason: `Matched ${rule.category} phrase`,
        evidencePhrases,
        scores: { [rule.category]: evidencePhrases.length }
      };
    }
  }

  return {
    category: 'GENERAL',
    method: 'rule',
    confidence: 0.6,
    reason: 'No Stage 1 category rule matched',
    evidencePhrases: [],
    scores: { GENERAL: 1 }
  };
}

