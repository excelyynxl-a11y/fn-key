import StatusBadge from './StatusBadge.jsx';

export default function EmailTable({ emails, selectedEmailId, onSelect, meta, page, onPage }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-5 py-4">
        <h2 className="font-semibold text-slate-900">Processed inbox</h2>
        <p className="mt-1 text-sm text-slate-500">Select an email to inspect its decision and evidence.</p>
      </div>
      <div className="max-h-[34rem] overflow-auto">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Result</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {emails.map((email) => (
              <tr
                key={email.emailId}
                className={`cursor-pointer transition hover:bg-blue-50 ${selectedEmailId === email.emailId ? 'bg-blue-50' : ''}`}
                onClick={() => onSelect(email.emailId)}
              >
                <td className="max-w-xs px-4 py-3">
                  <p className="font-medium text-slate-900">{email.emailId}</p>
                  <p className="truncate text-xs text-slate-500">{email.source?.subject}</p>
                </td>
                <td className="px-4 py-3 text-xs font-medium text-slate-600">
                  {email.result?.category?.replaceAll('_', ' ') ?? 'Pending'}
                </td>
                <td className="px-4 py-3"><StatusBadge value={email.result?.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        {emails.length === 0 && <p className="p-8 text-center text-sm text-slate-500">No processed emails yet.</p>}
      </div>
      <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-xs text-slate-500">
        <span>{meta?.total ?? emails.length} matching emails</span>
        <div className="flex items-center gap-2">
          <button type="button" disabled={page <= 1} onClick={() => onPage(page - 1)} className="rounded border border-slate-300 px-2 py-1 disabled:opacity-40">Previous</button>
          <span>Page {page}</span>
          <button type="button" disabled={page * (meta?.limit ?? 50) >= (meta?.total ?? 0)} onClick={() => onPage(page + 1)} className="rounded border border-slate-300 px-2 py-1 disabled:opacity-40">Next</button>
        </div>
      </div>
    </div>
  );
}

