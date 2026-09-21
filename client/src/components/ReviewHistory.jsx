import { useState } from 'react';
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
    <section className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Review history</h3>
          <p className="mt-1 text-xs text-slate-600">
            {review.status} · {review.reviewReason.replaceAll('_', ' ')} · {review.attempts?.length ?? 0} processing attempt{review.attempts?.length === 1 ? '' : 's'}
          </p>
        </div>
        {review.resolvedAt && <time className="text-xs text-slate-500">Resolved {new Date(review.resolvedAt).toLocaleString()}</time>}
      </div>
      {review.resolution && (
        <div className="mt-3 rounded-lg bg-white p-3 text-xs text-slate-700">
          <strong>{review.resolution.action}</strong>
          {review.resolution.reviewer && <> by {review.resolution.reviewer}</>}
          {review.resolution.note && <p className="mt-1">{review.resolution.note}</p>}
          {review.resolution.nextResult && <p className="mt-1 text-slate-500">Outcome: {outcomeLabel(review.resolution.nextResult)}</p>}
        </div>
      )}
      {review.status === 'resolved' && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button type="button" disabled={Boolean(busy)} onClick={() => act('retry')} className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40">
            {busy === 'retry' ? 'Retrying…' : 'Retry this email'}
          </button>
          <input className="min-w-64 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs" value={reason} onChange={(event) => setReason(event.target.value)} aria-label="Reason for reopening review" />
          <button type="button" disabled={Boolean(busy) || reason.trim().length < 3} onClick={() => act('reopen')} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-40">
            {busy === 'reopen' ? 'Reopening…' : 'Reopen review'}
          </button>
        </div>
      )}
      {message && <p className="mt-2 text-xs text-emerald-700">{message}</p>}
      {error && <p className="mt-2 text-xs text-rose-700">{error}</p>}
    </section>
  );
}
