import StatusBadge from './StatusBadge.jsx';

export default function RunProgress({ run }) {
  const counts = run?.counts ?? {};
  const finished = (counts.processed ?? 0) + (counts.failed ?? 0);
  const total = counts.total ?? 0;
  const percentage = total === 0 ? 0 : Math.round((finished / total) * 100);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">Processing run</p>
          <p className="mt-1 font-mono text-xs text-slate-500">{run.runId}</p>
        </div>
        <StatusBadge value={run.state} />
      </div>
      <div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${percentage}%` }} />
      </div>
      <div className="mt-2 flex justify-between text-sm text-slate-600">
        <span>{finished} of {total} emails</span>
        <span>{percentage}%</span>
      </div>
      <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ['Compared', counts.compared ?? 0],
          ['Mismatches', counts.mismatched ?? 0],
          ['Needs review', counts.review ?? 0],
          ['Failed', counts.failed ?? 0]
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl bg-slate-50 p-3">
            <dt className="text-xs text-slate-500">{label}</dt>
            <dd className="mt-1 text-xl font-semibold text-slate-900">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

