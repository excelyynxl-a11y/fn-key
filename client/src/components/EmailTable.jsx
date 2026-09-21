import { ChevronLeft, ChevronRight, Inbox } from 'lucide-react';
import StatusBadge from './StatusBadge.jsx';

export default function EmailTable({ emails, selectedEmailId, onSelect, meta, page, onPage }) {
  return (
    <div className="overflow-hidden rounded-lg border border-blue-900/60 bg-[#0a1526] shadow-sm">
      <div className="border-b border-blue-900/60 px-5 py-4">
        <h2 className="flex items-center gap-2 font-semibold text-white"><Inbox className="size-4 text-blue-400" /> Processed inbox</h2>
        <p className="mt-1 text-sm text-blue-300/60">Select an email to inspect its decision and evidence.</p>
      </div>
      <div className="max-h-[34rem] overflow-auto">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 bg-blue-950/80 text-xs uppercase tracking-wide text-blue-300/70">
            <tr>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Result</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-blue-900/40">
            {emails.map((email) => (
              <tr
                key={email.emailId}
                className={`cursor-pointer transition hover:bg-blue-900/30 ${selectedEmailId === email.emailId ? 'bg-blue-900/40' : ''}`}
                onClick={() => onSelect(email.emailId)}
              >
                <td className="max-w-xs px-4 py-3">
                  <p className="font-medium text-white">{email.emailId}</p>
                  <p className="truncate text-xs text-blue-300/60">{email.source?.subject}</p>
                </td>
                <td className="px-4 py-3 text-xs font-medium text-blue-300/70">
                  {email.result?.category?.replaceAll('_', ' ') ?? 'Pending'}
                </td>
                <td className="px-4 py-3"><StatusBadge value={email.result?.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        {emails.length === 0 && <p className="p-8 text-center text-sm text-blue-300/60">No processed emails yet.</p>}
      </div>
      <div className="flex items-center justify-between border-t border-blue-900/60 px-4 py-3 text-xs text-blue-300/60">
        <span>{meta?.total ?? emails.length} matching emails</span>
        <div className="flex items-center gap-2">
          <button type="button" disabled={page <= 1} onClick={() => onPage(page - 1)} className="inline-flex items-center gap-1 rounded-md border border-blue-800 bg-blue-950/50 px-2 py-1 text-blue-200 hover:bg-blue-900/50 disabled:opacity-40"><ChevronLeft className="size-3.5" /> Previous</button>
          <span>Page {page}</span>
          <button type="button" disabled={page * (meta?.limit ?? 50) >= (meta?.total ?? 0)} onClick={() => onPage(page + 1)} className="inline-flex items-center gap-1 rounded-md border border-blue-800 bg-blue-950/50 px-2 py-1 text-blue-200 hover:bg-blue-900/50 disabled:opacity-40">Next <ChevronRight className="size-3.5" /></button>
        </div>
      </div>
    </div>
  );
}
