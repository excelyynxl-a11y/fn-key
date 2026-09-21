import { Mail } from 'lucide-react';

export default function SourceEmailPanel({ source }) {
  if (!source) return null;
  return (
    <details className="mt-5 rounded-md border border-blue-900/60 bg-blue-950/40 p-4">
      <summary className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-blue-100"><Mail className="size-4 text-blue-400" /> Original email source</summary>
      <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
        <div><dt className="text-xs uppercase tracking-wide text-blue-300/60">Sender</dt><dd className="mt-1 break-all text-blue-100">{source.from}</dd></div>
        <div><dt className="text-xs uppercase tracking-wide text-blue-300/60">Subject</dt><dd className="mt-1 text-blue-100">{source.subject}</dd></div>
      </dl>
      <pre className="mt-4 max-h-72 overflow-auto whitespace-pre-wrap rounded-sm border border-blue-900/60 bg-[#060d1f] p-3 font-sans text-sm leading-6 text-blue-200/80">{source.body || 'No body content'}</pre>
    </details>
  );
}
