import { useCallback, useEffect, useState } from 'react';
import { request } from '../services/api.js';

const kinds = ['email_category', 'document_label', 'field_alias'];

export default function KnowledgePanel() {
  const [kind, setKind] = useState('email_category');
  const [entries, setEntries] = useState([]);
  const [events, setEvents] = useState([]);
  const [note, setNote] = useState('Reviewed in the operations knowledge console');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const [knowledge, audit] = await Promise.all([
        request(`/api/knowledge?kind=${kind}&limit=200`),
        request('/api/knowledge/audit?limit=20')
      ]);
      setEntries(knowledge.data);
      setEvents(audit.data);
      setError('');
    } catch (loadError) {
      setError(loadError.message);
    }
  }, [kind]);

  useEffect(() => { load(); }, [load]);

  async function update(entry, action) {
    try {
      await request(`/api/knowledge/${entry._id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, note })
      });
      await load();
    } catch (updateError) {
      setError(updateError.message);
    }
  }

  return (
    <details className="mt-4 rounded-2xl border border-violet-200 bg-violet-50 p-4 shadow-sm">
      <summary className="cursor-pointer font-semibold text-violet-950">Adaptive knowledge base</summary>
      <p className="mt-1 text-xs text-violet-800">Inspect provenance and safely change which learned signals participate in deterministic decisions.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {kinds.map((item) => <button type="button" key={item} onClick={() => setKind(item)} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${kind === item ? 'bg-violet-700 text-white' : 'bg-white text-violet-800'}`}>{item.replaceAll('_', ' ')}</button>)}
      </div>
      <input className="mt-3 w-full rounded-lg border border-violet-200 bg-white px-3 py-2 text-xs" value={note} onChange={(event) => setNote(event.target.value)} aria-label="Knowledge action note" />
      {error && <p className="mt-2 text-xs text-rose-700">{error}</p>}
      <div className="mt-3 max-h-80 overflow-auto rounded-xl border border-violet-100 bg-white">
        <table className="w-full min-w-[760px] text-left text-xs">
          <thead className="sticky top-0 bg-violet-100 text-violet-900"><tr><th className="p-2">Target / phrase</th><th className="p-2">Status</th><th className="p-2">Evidence</th><th className="p-2">Provenance</th><th className="p-2">Actions</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {entries.map((entry) => (
              <tr key={entry._id}>
                <td className="p-2"><strong>{entry.target}</strong><p className="mt-1 text-slate-600">{entry.phrase}</p></td>
                <td className="p-2">{entry.status}<p className="text-slate-400">weight {entry.weight}</p></td>
                <td className="p-2">support {entry.supportCount} · conflict {entry.conflictCount}<p className="text-slate-400">used {entry.usageCount}</p></td>
                <td className="p-2">{entry.source}<p className="text-slate-400">{entry.lastUsedAt ? new Date(entry.lastUsedAt).toLocaleDateString() : 'never used'}</p></td>
                <td className="p-2"><div className="flex flex-wrap gap-1">
                  {!['seed', 'trusted'].includes(entry.status) && <button type="button" onClick={() => update(entry, 'promote')} className="rounded bg-emerald-50 px-2 py-1 text-emerald-700">Promote</button>}
                  {entry.status !== 'blocked' && <button type="button" onClick={() => update(entry, 'block')} className="rounded bg-rose-50 px-2 py-1 text-rose-700">Block</button>}
                  {entry.status !== 'retired' && <button type="button" onClick={() => update(entry, 'retire')} className="rounded bg-slate-100 px-2 py-1 text-slate-700">Retire</button>}
                  {['blocked', 'retired'].includes(entry.status) && <button type="button" onClick={() => update(entry, 'restore')} className="rounded bg-blue-50 px-2 py-1 text-blue-700">Restore</button>}
                </div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <details className="mt-3 rounded-lg bg-white p-3">
        <summary className="cursor-pointer text-xs font-semibold text-violet-900">Recent learning and moderation audit</summary>
        <ul className="mt-2 space-y-2 text-xs text-slate-600">
          {events.map((event) => <li key={event._id}><strong>{event.eventType}</strong> · {event.details?.phrase ?? event.entityId} · {event.createdAt ? new Date(event.createdAt).toLocaleString() : ''}</li>)}
        </ul>
      </details>
    </details>
  );
}
