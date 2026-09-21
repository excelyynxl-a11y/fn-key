import { useCallback, useEffect, useState } from 'react';
import { Archive, ArrowUp, Ban, BookOpen, RotateCcw } from 'lucide-react';
import { request } from '../services/api.js';

const kinds = ['email_category', 'document_label', 'field_alias'];

const actionButtonClass = 'inline-flex min-h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold transition';

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
    <section className="rounded-2xl border border-sky-100 bg-white p-6 shadow-sm shadow-sky-100/70">
      <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-950"><BookOpen className="size-5 text-blue-600" /> Knowledge entries</h2>
      <p className="mt-2 text-sm text-slate-500">Inspect provenance and safely change which learned signals participate in deterministic decisions.</p>
      <div className="mt-5 flex flex-wrap gap-2 border-b border-sky-100 pb-5">
        {kinds.map((item) => <button type="button" key={item} onClick={() => setKind(item)} className={`min-h-10 rounded-xl px-4 text-xs font-semibold transition ${kind === item ? 'bg-blue-600 text-white shadow-sm' : 'border border-sky-200 bg-sky-50 text-slate-600 hover:bg-sky-100 hover:text-blue-700'}`}>{item.replaceAll('_', ' ')}</button>)}
      </div>
      <label className="mt-5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Moderation note</label>
      <input className="mt-2 min-h-11 w-full rounded-xl border border-sky-200 bg-white px-4 text-sm text-slate-700 shadow-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" value={note} onChange={(event) => setNote(event.target.value)} aria-label="Knowledge action note" />
      {error && <p className="mt-3 text-xs text-rose-700">{error}</p>}
      <div className="mt-5 max-h-[34rem] overflow-auto rounded-xl border border-sky-100 bg-white">
        <table className="w-full min-w-[760px] text-left text-xs">
          <thead className="sticky top-0 bg-sky-50 text-slate-600"><tr><th className="p-4">Target / phrase</th><th className="p-4">Status</th><th className="p-4">Evidence</th><th className="p-4">Provenance</th><th className="p-4">Actions</th></tr></thead>
          <tbody className="divide-y divide-sky-100 text-slate-700">
            {entries.map((entry) => (
              <tr key={entry._id}>
                <td className="p-4"><strong className="text-slate-950">{entry.target}</strong><p className="mt-1 max-w-md text-slate-500">{entry.phrase}</p></td>
                <td className="p-4">{entry.status}<p className="text-slate-400">weight {entry.weight}</p></td>
                <td className="p-4">support {entry.supportCount} · conflict {entry.conflictCount}<p className="text-slate-400">used {entry.usageCount}</p></td>
                <td className="p-4">{entry.source}<p className="text-slate-400">{entry.lastUsedAt ? new Date(entry.lastUsedAt).toLocaleDateString() : 'never used'}</p></td>
                <td className="p-4"><div className="flex flex-wrap gap-2">
                  {!['seed', 'trusted'].includes(entry.status) && <button type="button" onClick={() => update(entry, 'promote')} className={`${actionButtonClass} border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100`}><ArrowUp className="size-3" /> Promote</button>}
                  {entry.status !== 'blocked' && <button type="button" onClick={() => update(entry, 'block')} className={`${actionButtonClass} border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100`}><Ban className="size-3" /> Block</button>}
                  {entry.status !== 'retired' && <button type="button" onClick={() => update(entry, 'retire')} className={`${actionButtonClass} border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100`}><Archive className="size-3" /> Retire</button>}
                  {['blocked', 'retired'].includes(entry.status) && <button type="button" onClick={() => update(entry, 'restore')} className={`${actionButtonClass} border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100`}><RotateCcw className="size-3" /> Restore</button>}
                </div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <details className="mt-5 rounded-xl border border-sky-100 bg-sky-50 p-4">
        <summary className="cursor-pointer text-sm font-semibold text-slate-700">Recent learning and moderation audit</summary>
        <ul className="mt-3 space-y-3 text-xs text-slate-500">
          {events.map((event) => <li key={event._id}><strong className="text-slate-800">{event.eventType}</strong> · {event.details?.phrase ?? event.entityId} · {event.createdAt ? new Date(event.createdAt).toLocaleString() : ''}</li>)}
        </ul>
      </details>
    </section>
  );
}
