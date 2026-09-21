import { useEffect, useState } from 'react';
import { Download, RotateCcw, Square, Timer } from 'lucide-react';
import StatusBadge from './StatusBadge.jsx';

function elapsedLabel(startedAt, completedAt, now) {
  if (!startedAt) return 'Not started';
  const milliseconds = Math.max(0, new Date(completedAt ?? now).getTime() - new Date(startedAt).getTime());
  const seconds = Math.floor(milliseconds / 1000);
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

export default function RunProgress({ run, onFilter, onRetry, retrying, onExport, onCancel, cancelling }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (run.completedAt) return undefined;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [run.completedAt]);
  const counts = run?.counts ?? {};
  const finished = (counts.processed ?? 0) + (counts.failed ?? 0);
  const total = counts.total ?? 0;
  const percentage = total === 0 ? 0 : Math.round((finished / total) * 100);

  return (
    <section className="rounded-2xl border border-sky-100 bg-white p-6 shadow-sm shadow-sky-100/70">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-500">Processing run</p>
          <p className="mt-1 font-mono text-xs text-slate-400">{run.runId}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1 text-xs text-slate-500"><Timer className="size-3.5" /> Elapsed {elapsedLabel(run.startedAt, run.completedAt, now)}</span>
          <StatusBadge value={run.state} />
          {['queued', 'running', 'cancelling'].includes(run.state) && (
            <button type="button" disabled={cancelling || run.state === 'cancelling'} onClick={onCancel} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-50">
              <Square className="size-3.5" /> {cancelling || run.state === 'cancelling' ? 'Stopping…' : 'Stop process'}
            </button>
          )}
          {['completed', 'completed_with_errors'].includes(run.state) && (
            <button type="button" onClick={onExport} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-blue-600 px-4 text-xs font-semibold text-white shadow-sm hover:bg-blue-700"><Download className="size-3.5" /> Export JSON</button>
          )}
          {['completed', 'completed_with_errors', 'failed'].includes(run.state) && ((counts.review ?? 0) > 0 || (counts.failed ?? 0) > 0) && (
            <button type="button" disabled={retrying} onClick={onRetry} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-4 text-xs font-semibold text-blue-700 hover:bg-sky-100 disabled:opacity-50">
              <RotateCcw className={`size-3.5 ${retrying ? 'animate-spin' : ''}`} /> {retrying ? 'Retrying…' : 'Retry review/failed'}
            </button>
          )}
        </div>
      </div>
      <div className="mt-6 h-2.5 overflow-hidden rounded-full bg-sky-100">
        <div className="h-full rounded-full bg-gradient-to-r from-blue-600 to-sky-400 transition-all" style={{ width: `${percentage}%` }} />
      </div>
      <div className="mt-2 flex justify-between text-sm text-slate-500">
        <span>{finished} of {total} emails</span>
        <span>{percentage}%</span>
      </div>
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
        {[
          ['Total', total, {}],
          ['Processing', counts.processing ?? 0, { processingState: 'processing' }],
          ['OK', counts.ok ?? 0, { status: 'OK' }],
          ['Mismatch', counts.mismatched ?? 0, { status: 'MISMATCH' }],
          ['Needs review', counts.review ?? 0, { status: 'NEEDS_REVIEW' }],
          ['Failed', counts.failed ?? 0, { processingState: 'failed' }],
          ['AI fallback', counts.aiFallbacks ?? counts.aiClassified ?? 0, { method: 'ai' }]
        ].map(([label, value, filter]) => (
          <button type="button" onClick={() => onFilter(filter)} key={label} className="rounded-xl border border-sky-100 bg-sky-50/70 p-4 text-left transition hover:-translate-y-0.5 hover:border-blue-200 hover:bg-sky-100 focus:outline-none focus:ring-2 focus:ring-blue-500">
            <span className="block text-xs text-slate-500">{label}</span>
            <strong className="mt-1 block text-2xl font-semibold text-slate-950">{value}</strong>
          </button>
        ))}
      </div>
    </section>
  );
}
