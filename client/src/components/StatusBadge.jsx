import { CircleAlert, CircleCheck, CircleX, Clock, LoaderCircle, TriangleAlert } from 'lucide-react';

const styles = {
  OK: 'border-emerald-800 bg-emerald-500/10 text-emerald-300',
  MISMATCH: 'border-rose-800 bg-rose-500/10 text-rose-300',
  NEEDS_REVIEW: 'border-amber-800 bg-amber-500/10 text-amber-300',
  completed: 'border-emerald-800 bg-emerald-500/10 text-emerald-300',
  completed_with_errors: 'border-amber-800 bg-amber-500/10 text-amber-300',
  running: 'border-blue-800 bg-blue-500/10 text-blue-300',
  cancelling: 'border-amber-800 bg-amber-500/10 text-amber-300',
  cancelled: 'border-slate-700 bg-slate-500/10 text-slate-300',
  queued: 'border-blue-800 bg-blue-950/70 text-blue-300',
  failed: 'border-rose-800 bg-rose-500/10 text-rose-300'
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
  if (!value) return <span className="text-blue-400/60">Pending</span>;
  const Icon = icons[value] ?? CircleAlert;
  return (
    <span className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-semibold ${styles[value] ?? 'border-blue-800 bg-blue-950/70 text-blue-300'}`}>
      <Icon className={`size-3.5 ${['running', 'cancelling'].includes(value) ? 'animate-spin' : ''}`} aria-hidden="true" />
      {value.replaceAll('_', ' ')}
    </span>
  );
}
