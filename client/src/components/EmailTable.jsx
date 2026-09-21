import { ChevronLeft, ChevronRight, Inbox } from 'lucide-react';
import StatusBadge from './StatusBadge.jsx';

export default function EmailTable({ emails, selectedEmailId, onSelect, meta, page, onPage }) {
  return (
    <div className="min-w-0 max-w-full overflow-hidden rounded-2xl border border-sky-100 bg-white shadow-sm shadow-sky-100/70">
      <div className="border-b border-sky-100 px-5 py-5">
        <h2 className="flex items-center gap-2 font-semibold text-slate-950"><Inbox className="size-4 text-blue-600" /> Processed inbox</h2>
        <p className="mt-1 text-sm text-slate-500">Select an email to inspect its decision and evidence.</p>
      </div>
      <div className="max-h-[34rem] overflow-x-hidden overflow-y-auto">
        <table className="w-full table-fixed text-left text-sm">
          <thead className="sticky top-0 bg-sky-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="w-[42%] px-4 py-3">Email</th>
              <th className="w-[31%] px-3 py-3">Category</th>
              <th className="w-[27%] px-3 py-3">Result</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-sky-100">
            {emails.map((email) => (
              <tr
                key={email.emailId}
                className={`cursor-pointer transition hover:bg-sky-50 ${selectedEmailId === email.emailId ? 'bg-blue-50 ring-1 ring-inset ring-blue-100' : ''}`}
                onClick={() => onSelect(email.emailId)}
              >
                <td className="min-w-0 px-4 py-4">
                  <p className="font-medium text-slate-900">{email.emailId}</p>
                  <p className="mt-1 truncate text-xs text-slate-500">{email.source?.subject}</p>
                </td>
                <td className="break-words px-3 py-4 text-xs font-medium text-slate-600">
                  {email.result?.category?.replaceAll('_', ' ') ?? 'Pending'}
                </td>
                <td className="min-w-0 px-3 py-3"><StatusBadge value={email.result?.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        {emails.length === 0 && <p className="p-10 text-center text-sm text-slate-500">No processed emails yet.</p>}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-sky-100 px-4 py-4 text-xs text-slate-500">
        <span>{meta?.total ?? emails.length} matching emails</span>
        <div className="flex items-center gap-2">
          <button type="button" disabled={page <= 1} onClick={() => onPage(page - 1)} className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-sky-200 bg-white px-3 text-blue-700 hover:bg-sky-50 disabled:opacity-40"><ChevronLeft className="size-3.5" /> Previous</button>
          <span>Page {page}</span>
          <button type="button" disabled={page * (meta?.limit ?? 50) >= (meta?.total ?? 0)} onClick={() => onPage(page + 1)} className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-sky-200 bg-white px-3 text-blue-700 hover:bg-sky-50 disabled:opacity-40">Next <ChevronRight className="size-3.5" /></button>
        </div>
      </div>
    </div>
  );
}
