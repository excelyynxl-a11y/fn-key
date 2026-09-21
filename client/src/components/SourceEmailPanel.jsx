export default function SourceEmailPanel({ source }) {
  if (!source) return null;
  return (
    <details className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
      <summary className="cursor-pointer text-sm font-semibold text-slate-800">Original email source</summary>
      <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
        <div><dt className="text-xs uppercase tracking-wide text-slate-500">Sender</dt><dd className="mt-1 break-all text-slate-800">{source.from}</dd></div>
        <div><dt className="text-xs uppercase tracking-wide text-slate-500">Subject</dt><dd className="mt-1 text-slate-800">{source.subject}</dd></div>
      </dl>
      <pre className="mt-4 max-h-72 overflow-auto whitespace-pre-wrap rounded-lg bg-white p-3 font-sans text-sm leading-6 text-slate-700">{source.body || 'No body content'}</pre>
    </details>
  );
}
