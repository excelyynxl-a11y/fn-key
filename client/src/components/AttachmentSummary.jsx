import { Paperclip } from 'lucide-react';

function outcomeClass(attachment) {
  if (attachment.exists === false || ['unreadable', 'unsupported'].includes(attachment.parserStatus)) {
    return 'border-rose-200 bg-rose-50 text-rose-700';
  }
  if (attachment.scanned || attachment.parserWarnings?.length) {
    return 'border-amber-200 bg-amber-50 text-amber-800';
  }
  return 'border-sky-100 bg-sky-50 text-slate-700';
}

export default function AttachmentSummary({ attachments = [] }) {
  if (attachments.length === 0) return null;
  return (
    <div className="mt-5">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-950"><Paperclip className="size-4 text-blue-600" /> Attachment processing</h3>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {attachments.map((attachment) => (
          <div key={attachment.reference} className={`rounded-xl border p-4 text-xs ${outcomeClass(attachment)}`}>
            <p className="truncate font-semibold" title={attachment.filename}>{attachment.filename}</p>
            <p className="mt-1 uppercase tracking-wide">
              {attachment.detectedFormat ?? attachment.extension?.replace('.', '') ?? 'unknown format'}
              {' · '}{attachment.exists === false ? 'missing' : attachment.parserStatus ?? 'not parsed'}
              {attachment.documentType && attachment.documentType !== 'UNKNOWN' ? ` · ${attachment.documentType}` : ''}
            </p>
            {attachment.roleMethod && <p className="mt-1">Role identified by {attachment.roleMethod}{attachment.roleConfidence != null ? ` · ${Math.round(attachment.roleConfidence * 100)}%` : ''}</p>}
            {attachment.parserError?.message && <p className="mt-1">{attachment.parserError.message}</p>}
            {!attachment.parserError?.message && attachment.parserWarnings?.[0] && (
              <p className="mt-1">{attachment.parserWarnings[0]}</p>
            )}
            {attachment.roleEvidence?.length > 0 && (
              <details className="mt-2">
                <summary className="cursor-pointer font-semibold">Role evidence</summary>
                <ul className="mt-1 space-y-1">
                  {attachment.roleEvidence.map((item, index) => <li key={`${item.phrase}-${index}`}>“{item.phrase}” · {item.source}</li>)}
                </ul>
              </details>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
