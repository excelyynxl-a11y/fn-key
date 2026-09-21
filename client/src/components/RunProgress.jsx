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
    <section className="rounded-lg border border-blue-900/60 bg-[#0a1526] p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-500">Processing run</p>
          <p className="mt-1 font-mono text-xs text-blue-400/70">{run.runId}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1 text-xs text-blue-300/60"><Timer className="size-3.5" /> Elapsed {elapsedLabel(run.startedAt, run.completedAt, now)}</span>
          <StatusBadge value={run.state} />
          {['queued', 'running', 'cancelling'].includes(run.state) && (
            <button type="button" disabled={cancelling || run.state === 'cancelling'} onClick={onCancel} className="inline-flex items-center gap-1.5 rounded-md border border-rose-800 bg-rose-950/40 px-3 py-1.5 text-xs font-semibold text-rose-200 hover:bg-rose-900/50 disabled:opacity-50">
              <Square className="size-3.5" /> {cancelling || run.state === 'cancelling' ? 'Stopping…' : 'Stop process'}
            </button>
          )}
          {['completed', 'completed_with_errors'].includes(run.state) && (
            <button type="button" onClick={onExport} className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-500"><Download className="size-3.5" /> Export JSON</button>
          )}
          {['completed', 'completed_with_errors', 'failed'].includes(run.state) && ((counts.review ?? 0) > 0 || (counts.failed ?? 0) > 0) && (
            <button type="button" disabled={retrying} onClick={onRetry} className="inline-flex items-center gap-1.5 rounded-md border border-blue-800 bg-blue-950/50 px-3 py-1.5 text-xs font-semibold text-blue-200 hover:bg-blue-900/50 disabled:opacity-50">
              <RotateCcw className={`size-3.5 ${retrying ? 'animate-spin' : ''}`} /> {retrying ? 'Retrying…' : 'Retry review/failed'}
            </button>
          )}
        </div>
      </div>
      <div className="mt-5 h-2 overflow-hidden rounded-sm bg-blue-950">
        <div className="h-full rounded-sm bg-blue-600 transition-all" style={{ width: `${percentage}%` }} />
      </div>
      <div className="mt-2 flex justify-between text-sm text-blue-300/70">
        <span>{finished} of {total} emails</span>
        <span>{percentage}%</span>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
        {[
          ['Total', total, {}],
          ['Processing', counts.processing ?? 0, { processingState: 'processing' }],
          ['OK', counts.ok ?? 0, { status: 'OK' }],
          ['Mismatch', counts.mismatched ?? 0, { status: 'MISMATCH' }],
          ['Needs review', counts.review ?? 0, { status: 'NEEDS_REVIEW' }],
          ['Failed', counts.failed ?? 0, { processingState: 'failed' }],
          ['AI fallback', counts.aiFallbacks ?? counts.aiClassified ?? 0, { method: 'ai' }]
        ].map(([label, value, filter]) => (
          <button type="button" onClick={() => onFilter(filter)} key={label} className="rounded-md bg-blue-950/50 p-3 text-left ring-1 ring-blue-900/60 transition hover:bg-blue-900/40 focus:outline-none focus:ring-2 focus:ring-blue-500">
            <span className="block text-xs text-blue-300/60">{label}</span>
            <strong className="mt-1 block text-xl font-semibold text-white">{value}</strong>
          </button>
        ))}
      </div>
    </section>
  );
}
