const styles = {
  OK: 'bg-emerald-100 text-emerald-700',
  MISMATCH: 'bg-rose-100 text-rose-700',
  NEEDS_REVIEW: 'bg-amber-100 text-amber-800',
  completed: 'bg-emerald-100 text-emerald-700',
  completed_with_errors: 'bg-amber-100 text-amber-800',
  running: 'bg-blue-100 text-blue-700',
  queued: 'bg-slate-100 text-slate-700',
  failed: 'bg-rose-100 text-rose-700'
};

const symbols = {
  OK: '✓', MISMATCH: '!', NEEDS_REVIEW: '?', completed: '✓', completed_with_errors: '!',
  running: '↻', queued: '…', failed: '×'
};

export default function StatusBadge({ value }) {
  if (!value) return <span className="text-slate-400">Pending</span>;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${styles[value] ?? 'bg-slate-100 text-slate-700'}`}>
      <span aria-hidden="true">{symbols[value] ?? '•'}</span>{value.replaceAll('_', ' ')}
    </span>
  );
}

