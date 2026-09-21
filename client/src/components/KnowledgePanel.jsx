import { useCallback, useEffect, useState } from 'react';
import { Archive, ArrowUp, Ban, BookOpen, RotateCcw } from 'lucide-react';
import { request } from '../services/api.js';

const kinds = ['email_category', 'document_label', 'field_alias'];

const actionButtonClass = 'inline-flex items-center gap-1 rounded-md border px-2 py-1';

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
      <div className="mt-3 flex flex-wrap gap-2">
        {kinds.map((item) => <button type="button" key={item} onClick={() => setKind(item)} className={`rounded-md px-3 py-1.5 text-xs font-semibold ${kind === item ? 'bg-violet-700 text-white' : 'border border-violet-800 bg-violet-950/60 text-violet-300 hover:bg-violet-900/50'}`}>{item.replaceAll('_', ' ')}</button>)}
      </div>
      <input className="mt-3 w-full rounded-md border border-violet-800 bg-[#0a1526] px-3 py-2 text-xs text-blue-100" value={note} onChange={(event) => setNote(event.target.value)} aria-label="Knowledge action note" />
      {error && <p className="mt-2 text-xs text-rose-300">{error}</p>}
      <div className="mt-3 max-h-80 overflow-auto rounded-md border border-violet-900/60 bg-[#0a1526]">
        <table className="w-full min-w-[760px] text-left text-xs">
          <thead className="sticky top-0 bg-violet-950/80 text-violet-200"><tr><th className="p-2">Target / phrase</th><th className="p-2">Status</th><th className="p-2">Evidence</th><th className="p-2">Provenance</th><th className="p-2">Actions</th></tr></thead>
          <tbody className="divide-y divide-blue-900/40 text-blue-200/80">
            {entries.map((entry) => (
              <tr key={entry._id}>
                <td className="p-2"><strong className="text-white">{entry.target}</strong><p className="mt-1 text-blue-300/70">{entry.phrase}</p></td>
                <td className="p-2">{entry.status}<p className="text-blue-400/60">weight {entry.weight}</p></td>
                <td className="p-2">support {entry.supportCount} · conflict {entry.conflictCount}<p className="text-blue-400/60">used {entry.usageCount}</p></td>
                <td className="p-2">{entry.source}<p className="text-blue-400/60">{entry.lastUsedAt ? new Date(entry.lastUsedAt).toLocaleDateString() : 'never used'}</p></td>
                <td className="p-2"><div className="flex flex-wrap gap-1">
                  {!['seed', 'trusted'].includes(entry.status) && <button type="button" onClick={() => update(entry, 'promote')} className={`${actionButtonClass} border-emerald-800 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20`}><ArrowUp className="size-3" /> Promote</button>}
                  {entry.status !== 'blocked' && <button type="button" onClick={() => update(entry, 'block')} className={`${actionButtonClass} border-rose-800 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20`}><Ban className="size-3" /> Block</button>}
                  {entry.status !== 'retired' && <button type="button" onClick={() => update(entry, 'retire')} className={`${actionButtonClass} border-blue-800 bg-blue-950/70 text-blue-300 hover:bg-blue-900/50`}><Archive className="size-3" /> Retire</button>}
                  {['blocked', 'retired'].includes(entry.status) && <button type="button" onClick={() => update(entry, 'restore')} className={`${actionButtonClass} border-blue-800 bg-blue-500/10 text-blue-300 hover:bg-blue-500/20`}><RotateCcw className="size-3" /> Restore</button>}
                </div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <details className="mt-3 rounded-md border border-violet-900/60 bg-[#0a1526] p-3">
        <summary className="cursor-pointer text-xs font-semibold text-violet-300">Recent learning and moderation audit</summary>
        <ul className="mt-2 space-y-2 text-xs text-blue-300/70">
          {events.map((event) => <li key={event._id}><strong className="text-blue-100">{event.eventType}</strong> · {event.details?.phrase ?? event.entityId} · {event.createdAt ? new Date(event.createdAt).toLocaleString() : ''}</li>)}
        </ul>
      </details>
    </section>
  );
}
