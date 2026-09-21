import { useCallback, useEffect, useState } from 'react';
import { LoaderCircle, Play } from 'lucide-react';
import EmailTable from '../components/EmailTable.jsx';
import AttachmentSummary from '../components/AttachmentSummary.jsx';
import ClassificationEvidence from '../components/ClassificationEvidence.jsx';
import FieldComparisonTable from '../components/FieldComparisonTable.jsx';
import InboxFilters, { emptyInboxFilters } from '../components/InboxFilters.jsx';
import KnowledgePanel from '../components/KnowledgePanel.jsx';
import MetricsPanel from '../components/MetricsPanel.jsx';
import RunProgress from '../components/RunProgress.jsx';
import Sidebar from '../components/Sidebar.jsx';
import SourceEmailPanel from '../components/SourceEmailPanel.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import ProcessingTimeline from '../components/ProcessingTimeline.jsx';
import ReviewEditor from '../components/ReviewEditor.jsx';
import ReviewHistory from '../components/ReviewHistory.jsx';
import ReviewQueue from '../components/ReviewQueue.jsx';
import { request } from '../services/api.js';

const terminalRunStates = ['completed', 'completed_with_errors', 'cancelled'];

const LandingPage = () => {
  const [run, setRun] = useState(null);
  const [emails, setEmails] = useState([]);
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [filterDraft, setFilterDraft] = useState({ ...emptyInboxFilters });
  const [appliedFilters, setAppliedFilters] = useState({ ...emptyInboxFilters });
  const [emailMeta, setEmailMeta] = useState({ page: 1, limit: 50, total: 0 });
  const [page, setPage] = useState(1);
  const [retrying, setRetrying] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [offline, setOffline] = useState(false);
  const [reviews, setReviews] = useState([]);
  const [reviewMeta, setReviewMeta] = useState({ total: 0, grouped: {} });
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [activeView, setActiveView] = useState('dashboard');

  const loadEmails = useCallback(async (runId, filters = emptyInboxFilters, requestedPage = 1) => {
    const query = new URLSearchParams({ runId, limit: '50', page: String(requestedPage) });
    Object.entries(filters).forEach(([key, value]) => {
      if (value) query.set(key, value);
    });
    const response = await request(`/api/emails?${query}`);
    setEmails(response.data);
    setEmailMeta(response.meta);
    setPage(requestedPage);
    const preferred = response.data.find((email) => email.emailId === 'email_004') ?? response.data[0];
    if (preferred) {
      const detail = await request(`/api/emails/${preferred.emailId}?runId=${encodeURIComponent(runId)}`);
      setSelectedEmail(detail.data);
    } else setSelectedEmail(null);
    setOffline(false);
  }, []);

  const loadReviews = useCallback(async (runId) => {
    const response = await request(`/api/reviews?runId=${encodeURIComponent(runId)}&status=open`);
    setReviews(response.data);
    setReviewMeta(response.meta);
  }, []);

  const refreshRun = useCallback(async (runId) => {
    const response = await request(`/api/runs/${runId}`);
    setRun(response.data);
    if (terminalRunStates.includes(response.data.state)) {
      await loadEmails(runId, appliedFilters, page);
      await loadReviews(runId);
    }
  }, [appliedFilters, loadEmails, loadReviews, page]);

  useEffect(() => {
    let cancelled = false;
    request('/api/runs?limit=1')
      .then(async (response) => {
        if (cancelled || response.data.length === 0) return;
        setRun(response.data[0]);
        if (terminalRunStates.includes(response.data[0].state)) {
          await loadEmails(response.data[0].runId, emptyInboxFilters, 1);
          await loadReviews(response.data[0].runId);
        }
      })
      .catch((loadError) => {
        if (!cancelled) {
          setError(loadError.message);
          setOffline(loadError instanceof TypeError);
        }
      })
      .finally(() => !cancelled && setBusy(false));
    return () => { cancelled = true; };
  }, [loadEmails, loadReviews]);

  useEffect(() => {
    if (!run || !['queued', 'running', 'cancelling'].includes(run.state)) return undefined;
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
      const response = await request(`/api/emails/${emailId}?runId=${encodeURIComponent(run.runId)}`);
      setSelectedEmail(response.data);
    } catch (selectError) {
      setError(selectError.message);
    }
  }

  async function applyFilters(nextFilters = filterDraft, requestedPage = 1) {
    if (!run) return;
    setAppliedFilters(nextFilters);
    setError('');
    try {
      await loadEmails(run.runId, nextFilters, requestedPage);
    } catch (filterError) {
      setError(filterError.message);
      setOffline(filterError instanceof TypeError);
    }
  }

  function clearFilters() {
    const cleared = { ...emptyInboxFilters };
    setFilterDraft(cleared);
    applyFilters(cleared, 1);
  }

  function applySummaryFilter(filter) {
    const next = { ...emptyInboxFilters, ...filter };
    setFilterDraft({ ...emptyInboxFilters, ...filter });
    applyFilters(next, 1);
  }

  async function retryRun() {
    setRetrying(true);
    setError('');
    try {
      const response = await request(`/api/runs/${run.runId}/retry`, { method: 'POST' });
      setRun(response.data);
      setEmails([]);
      setSelectedEmail(null);
      setReviews([]);
    } catch (retryError) {
      setError(retryError.message);
    } finally {
      setRetrying(false);
    }
  }

  async function cancelRun() {
    setCancelling(true);
    setError('');
    try {
      const response = await request(`/api/runs/${run.runId}/cancel`, { method: 'POST' });
      setRun(response.data);
    } catch (cancelError) {
      setError(cancelError.message);
    } finally {
      setCancelling(false);
    }
  }

  async function exportSubmission() {
    try {
      const submission = await request(`/api/runs/${run.runId}/submission`);
      const url = URL.createObjectURL(new Blob([JSON.stringify(submission, null, 2)], { type: 'application/json' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `sdoc-submission-${run.runId}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (exportError) {
      setError(exportError.message);
    }
  }

  async function completeReview() {
    const emailId = selectedEmail.emailId;
    await Promise.all([loadReviews(run.runId), loadEmails(run.runId, appliedFilters, page)]);
    await selectEmail(emailId);
    const response = await request(`/api/runs/${run.runId}`);
    setRun(response.data);
  }

  return (
    <div className="min-h-screen lg:flex">
      <Sidebar activeView={activeView} onNavigate={setActiveView} />
      <main className="min-w-0 flex-1 px-5 py-8 sm:px-8 lg:px-12 xl:px-14">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-600">{activeView === 'dashboard' ? 'Operations workspace' : 'Adaptive intelligence'}</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">{activeView === 'dashboard' ? 'Review with confidence' : 'Adaptive knowledge base'}</h1>
            <p className="mt-3 max-w-2xl text-base text-slate-500">{activeView === 'dashboard' ? 'Process shipping documents, investigate exceptions, and keep every decision explainable.' : 'Review, promote, block, and audit the knowledge used by deterministic classification.'}</p>
          </div>
          {activeView === 'dashboard' && <button
            type="button"
            onClick={startRun}
            disabled={busy || ['queued', 'running', 'cancelling'].includes(run?.state)}
            className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-blue-600 px-6 text-sm font-semibold text-white shadow-lg shadow-blue-200 transition hover:-translate-y-0.5 hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 disabled:shadow-none"
          >
            {['queued', 'running', 'cancelling'].includes(run?.state)
              ? <><LoaderCircle className="size-4 animate-spin" /> Processing…</>
              : <><Play className="size-4" /> Start new run</>}
          </button>}
        </header>

        {activeView === 'knowledge' ? (
          <div className="mt-10"><KnowledgePanel /></div>
        ) : <>
        {error && <div className="mt-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{offline ? 'Offline: ' : ''}{error}</div>}
        {run?.runErrors?.length > 0 && (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Partial errors: {run.runErrors.slice(0, 3).map(({ emailId, message }) => `${emailId ?? 'run'}: ${message}`).join(' · ')}
          </div>
        )}
        {busy && !run && <p className="mt-10 text-sm text-slate-500">Loading workspace…</p>}

        {run && <div className="mt-8"><RunProgress run={run} onFilter={applySummaryFilter} onRetry={retryRun} retrying={retrying} onExport={exportSubmission} onCancel={cancelRun} cancelling={cancelling} /></div>}

        {run && terminalRunStates.includes(run.state) && (
          <div className="mt-4"><ReviewQueue reviews={reviews} grouped={reviewMeta.grouped} onSelect={selectEmail} selectedEmailId={selectedEmail?.emailId} /></div>
        )}
        {run && terminalRunStates.includes(run.state) && (
          <MetricsPanel runId={run.runId} refreshKey={run.updatedAt ?? run.completedAt} />
        )}

        {!run && !busy && (
          <section className="mt-10 rounded-2xl border border-dashed border-blue-200 bg-white p-14 text-center shadow-sm">
            <h2 className="text-xl font-semibold text-slate-950">No processing run yet</h2>
            <p className="mt-2 text-sm text-slate-500">Start a run to import and process the 520-email challenge bundle.</p>
          </section>
        )}

        {run && terminalRunStates.includes(run.state) && (
          <div className="mt-10 grid gap-8 xl:grid-cols-[minmax(390px,0.85fr)_minmax(0,1.55fr)]">
            <div className="space-y-5">
              <InboxFilters
                value={filterDraft}
                onChange={setFilterDraft}
                onApply={() => applyFilters(filterDraft, 1)}
                onClear={clearFilters}
              />
              <EmailTable
                emails={emails}
                selectedEmailId={selectedEmail?.emailId}
                onSelect={selectEmail}
                meta={emailMeta}
                page={page}
                onPage={(nextPage) => applyFilters(appliedFilters, nextPage)}
              />
            </div>
            <section className="min-w-0 rounded-2xl border border-sky-100 bg-white p-6 shadow-sm shadow-sky-100/70 lg:p-8">
              {selectedEmail ? (
                <>
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="font-mono text-xs text-blue-500">{selectedEmail.emailId}</p>
                      <h2 className="mt-2 text-2xl font-semibold leading-snug text-slate-950">{selectedEmail.source?.subject}</h2>
                      <p className="mt-2 text-sm text-slate-500">From {selectedEmail.source?.from}</p>
                    </div>
                    <StatusBadge value={selectedEmail.result?.status} />
                  </div>
                  <div className="mt-6 rounded-xl border border-sky-100 bg-sky-50 p-4 text-sm text-slate-700">
                    <span className="font-semibold">Classification:</span>{' '}
                    {selectedEmail.result?.category?.replaceAll('_', ' ')} via {selectedEmail.classification?.method}
                    {selectedEmail.result?.reviewReason && <span> · {selectedEmail.result.reviewReason.replaceAll('_', ' ')}</span>}
                  </div>
                  <SourceEmailPanel source={selectedEmail.source} />
                  <ClassificationEvidence classification={selectedEmail.classification} />
                  {selectedEmail.result?.category === 'BL_COMPARISON' && (
                    <AttachmentSummary attachments={selectedEmail.source?.attachments} />
                  )}
                  {selectedEmail.result?.category === 'BL_COMPARISON' && selectedEmail.documents?.si?.fields
                    ? <div className="mt-5"><FieldComparisonTable email={selectedEmail} /></div>
                    : <p className="mt-6 text-sm text-slate-500">
                        {selectedEmail.result?.category === 'BL_COMPARISON'
                          ? 'Field comparison stopped at the review reason shown above.'
                          : 'This category does not continue to document comparison.'}
                      </p>}
                  <ProcessingTimeline events={selectedEmail.timeline} />
                  <ReviewHistory
                    review={selectedEmail.review}
                    emailId={selectedEmail.emailId}
                    runId={run.runId}
                    onComplete={completeReview}
                  />
                  {selectedEmail.review?.status === 'open' && (
                    <ReviewEditor
                      review={selectedEmail.review}
                      email={selectedEmail}
                      onComplete={completeReview}
                    />
                  )}
                </>
              ) : <p className="text-sm text-slate-500">Select an email to inspect it.</p>}
            </section>
          </div>
        )}
        </>}
      </main>
    </div>
  );
}

export default LandingPage
