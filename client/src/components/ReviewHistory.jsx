import { useState } from 'react';
import { FolderOpen, History, RotateCcw } from 'lucide-react';
import { request } from '../services/api.js';

function outcomeLabel(result) {
  if (!result) return 'No recorded outcome';
  return [result.status, result.reviewReason?.replaceAll('_', ' ')].filter(Boolean).join(' · ');
}

export default function ReviewHistory({ review, emailId, runId, onComplete }) {
  const [reason, setReason] = useState('Reopen for another operations review');
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  if (!review) return null;

  async function act(kind) {
    setBusy(kind);
    setMessage('');
    setError('');
    try {
      if (kind === 'retry') {
        const response = await request(`/api/emails/${emailId}/retry`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ runId })
        });
        setMessage(`Retry completed: ${outcomeLabel(response.data.result)}`);
      } else {
        await request(`/api/reviews/${review.reviewId}/reopen`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ expectedVersion: review.__v, reason })
        });
        setMessage('Review reopened.');
      }
      await onComplete();
    } catch (actionError) {
      setError(actionError.message);
    } finally {
      setBusy('');
    }
  }

  return (
    <section className="mt-5 rounded-md border border-blue-900/60 bg-blue-950/40 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-white"><History className="size-4 text-blue-400" /> Review history</h3>
          <p className="mt-1 text-xs text-blue-300/70">
            {review.status} · {review.reviewReason.replaceAll('_', ' ')} · {review.attempts?.length ?? 0} processing attempt{review.attempts?.length === 1 ? '' : 's'}
          </p>
        </div>
        {review.resolvedAt && <time className="text-xs text-blue-400/60">Resolved {new Date(review.resolvedAt).toLocaleString()}</time>}
      </div>
      {review.resolution && (
        <div className="mt-3 rounded-md border border-blue-900/60 bg-[#0a1526] p-3 text-xs text-blue-200/80">
          <strong className="text-white">{review.resolution.action}</strong>
          {review.resolution.reviewer && <> by {review.resolution.reviewer}</>}
          {review.resolution.note && <p className="mt-1">{review.resolution.note}</p>}
          {review.resolution.nextResult && <p className="mt-1 text-blue-300/60">Outcome: {outcomeLabel(review.resolution.nextResult)}</p>}
        </div>
      )}
      {review.status === 'resolved' && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button type="button" disabled={Boolean(busy)} onClick={() => act('retry')} className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-40">
            <RotateCcw className={`size-3.5 ${busy === 'retry' ? 'animate-spin' : ''}`} /> {busy === 'retry' ? 'Retrying…' : 'Retry this email'}
          </button>
          <input className="min-w-64 flex-1 rounded-md border border-blue-800 bg-blue-950/50 px-3 py-2 text-xs text-blue-100" value={reason} onChange={(event) => setReason(event.target.value)} aria-label="Reason for reopening review" />
          <button type="button" disabled={Boolean(busy) || reason.trim().length < 3} onClick={() => act('reopen')} className="inline-flex items-center gap-1.5 rounded-md border border-blue-800 bg-blue-950/50 px-3 py-2 text-xs font-semibold text-blue-200 hover:bg-blue-900/50 disabled:opacity-40">
            <FolderOpen className="size-3.5" /> {busy === 'reopen' ? 'Reopening…' : 'Reopen review'}
          </button>
        </div>
      )}
      {message && <p className="mt-2 text-xs text-emerald-300">{message}</p>}
      {error && <p className="mt-2 text-xs text-rose-300">{error}</p>}
    </section>
  );
}
