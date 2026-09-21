import { Mail } from 'lucide-react';

export default function SourceEmailPanel({ source }) {
  if (!source) return null;
  return (
    <details className="mt-6 rounded-xl border border-sky-100 bg-sky-50/60 p-5">
      <summary className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-slate-800"><Mail className="size-4 text-blue-600" /> Original email source</summary>
      <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
        <div><dt className="text-xs uppercase tracking-wide text-slate-400">Sender</dt><dd className="mt-1 break-all text-slate-700">{source.from}</dd></div>
        <div><dt className="text-xs uppercase tracking-wide text-slate-400">Subject</dt><dd className="mt-1 text-slate-700">{source.subject}</dd></div>
      </dl>
      <pre className="mt-4 max-h-72 overflow-auto whitespace-pre-wrap rounded-xl border border-sky-100 bg-white p-4 font-sans text-sm leading-7 text-slate-600">{source.body || 'No body content'}</pre>
    </details>
  );
}
