import { CircleAlert, CircleCheck, CircleX, Clock, LoaderCircle, TriangleAlert } from 'lucide-react';

const styles = {
  OK: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  MISMATCH: 'border-rose-200 bg-rose-50 text-rose-700',
  NEEDS_REVIEW: 'border-amber-200 bg-amber-50 text-amber-700',
  completed: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  completed_with_errors: 'border-amber-200 bg-amber-50 text-amber-700',
  running: 'border-blue-200 bg-blue-50 text-blue-700',
  cancelling: 'border-amber-200 bg-amber-50 text-amber-700',
  cancelled: 'border-slate-200 bg-slate-50 text-slate-600',
  queued: 'border-blue-200 bg-blue-50 text-blue-700',
  failed: 'border-rose-200 bg-rose-50 text-rose-700'
};

const icons = {
  OK: CircleCheck,
  MISMATCH: CircleX,
  NEEDS_REVIEW: TriangleAlert,
  completed: CircleCheck,
  completed_with_errors: TriangleAlert,
  running: LoaderCircle,
  cancelling: LoaderCircle,
  cancelled: CircleX,
  queued: Clock,
  failed: CircleX
};

export default function StatusBadge({ value }) {
  if (!value) return <span className="text-slate-400">Pending</span>;
  const Icon = icons[value] ?? CircleAlert;
  return (
    <span className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-semibold ${styles[value] ?? 'border-sky-200 bg-sky-50 text-blue-700'}`}>
      <Icon className={`size-3.5 ${['running', 'cancelling'].includes(value) ? 'animate-spin' : ''}`} aria-hidden="true" />
      {value.replaceAll('_', ' ')}
    </span>
  );
}
