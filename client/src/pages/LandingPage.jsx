import { useCallback, useEffect, useState } from 'react';
import EmailTable from '../components/EmailTable.jsx';
import FieldComparisonTable from '../components/FieldComparisonTable.jsx';
import RunProgress from '../components/RunProgress.jsx';
import Sidebar from '../components/Sidebar.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import { request } from '../services/api.js';

const LandingPage = () => {
  const [run, setRun] = useState(null);
  const [emails, setEmails] = useState([]);
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');

  const loadEmails = useCallback(async (runId) => {
    const response = await request(`/api/emails?runId=${encodeURIComponent(runId)}&limit=100`);
    setEmails(response.data);
    const preferred = response.data.find((email) => email.emailId === 'email_004') ?? response.data[0];
    if (preferred) {
      const detail = await request(`/api/emails/${preferred.emailId}`);
      setSelectedEmail(detail.data);
    }
  }, []);

  const refreshRun = useCallback(async (runId) => {
    const response = await request(`/api/runs/${runId}`);
    setRun(response.data);
    if (['completed', 'completed_with_errors'].includes(response.data.state)) {
      await loadEmails(runId);
    }
  }, [loadEmails]);

  useEffect(() => {
    let cancelled = false;
    request('/api/runs?limit=1')
      .then(async (response) => {
        if (cancelled || response.data.length === 0) return;
        setRun(response.data[0]);
        if (['completed', 'completed_with_errors'].includes(response.data[0].state)) {
          await loadEmails(response.data[0].runId);
        }
      })
      .catch((loadError) => !cancelled && setError(loadError.message))
      .finally(() => !cancelled && setBusy(false));
    return () => { cancelled = true; };
  }, [loadEmails]);

  useEffect(() => {
    if (!run || !['queued', 'running'].includes(run.state)) return undefined;
    const timer = window.setInterval(() => {
      refreshRun(run.runId).catch((refreshError) => setError(refreshError.message));
    }, 1200);
    return () => window.clearInterval(timer);
  }, [run, refreshRun]);

  async function startRun() {
    setBusy(true);
    setError('');
    setEmails([]);
    setSelectedEmail(null);
    try {
      const response = await request('/api/runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: 'bundle' })
      });
      setRun(response.data);
    } catch (startError) {
      setError(startError.message);
    } finally {
      setBusy(false);
    }
  }

  async function selectEmail(emailId) {
    setError('');
    try {
      const response = await request(`/api/emails/${emailId}`);
      setSelectedEmail(response.data);
    } catch (selectError) {
      setError(selectError.message);
    }
  }

  return (
    <div className="min-h-screen lg:flex">
      <Sidebar />
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-8 lg:px-10">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-blue-600">Adaptive shipping document verification</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950">Inbox processing dashboard</h1>
            <p className="mt-2 text-sm text-slate-600">Import the challenge bundle, compare SI and BL fields, and inspect every decision.</p>
          </div>
          <button
            type="button"
            onClick={startRun}
            disabled={busy || ['queued', 'running'].includes(run?.state)}
            className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            {['queued', 'running'].includes(run?.state) ? 'Processing…' : 'Start new run'}
          </button>
        </header>

        {error && <div className="mt-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}
        {busy && !run && <p className="mt-10 text-sm text-slate-500">Loading workspace…</p>}

        {run && <div className="mt-8"><RunProgress run={run} /></div>}

        {!run && !busy && (
          <section className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
            <h2 className="text-lg font-semibold text-slate-900">No processing run yet</h2>
            <p className="mt-2 text-sm text-slate-500">Start a run to import and process the 520-email challenge bundle.</p>
          </section>
        )}

        {run && emails.length > 0 && (
          <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(360px,0.8fr)_minmax(0,1.5fr)]">
            <EmailTable emails={emails} selectedEmailId={selectedEmail?.emailId} onSelect={selectEmail} />
            <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              {selectedEmail ? (
                <>
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="font-mono text-xs text-blue-600">{selectedEmail.emailId}</p>
                      <h2 className="mt-1 text-xl font-semibold text-slate-950">{selectedEmail.source?.subject}</h2>
                      <p className="mt-1 text-sm text-slate-500">From {selectedEmail.source?.from}</p>
                    </div>
                    <StatusBadge value={selectedEmail.result?.status} />
                  </div>
                  <div className="mt-5 rounded-xl bg-slate-50 p-4 text-sm text-slate-700">
                    <span className="font-semibold">Classification:</span>{' '}
                    {selectedEmail.result?.category?.replaceAll('_', ' ')} via {selectedEmail.classification?.method}
                    {selectedEmail.result?.reviewReason && <span> · {selectedEmail.result.reviewReason.replaceAll('_', ' ')}</span>}
                  </div>
                  {selectedEmail.result?.category === 'BL_COMPARISON' && selectedEmail.documents?.si?.fields
                    ? <div className="mt-5"><FieldComparisonTable email={selectedEmail} /></div>
                    : <p className="mt-6 text-sm text-slate-500">This category does not continue to document comparison in Stage 1.</p>}
                </>
              ) : <p className="text-sm text-slate-500">Select an email to inspect it.</p>}
            </section>
          </div>
        )}
      </main>
    </div>
  );
}

export default LandingPage
