import { useEffect, useState } from 'react';
import { TrendingUp } from 'lucide-react';
import { request } from '../services/api.js';

function percentage(value) { return `${Math.round((value ?? 0) * 100)}%`; }

export default function MetricsPanel({ runId, refreshKey }) {
  const [metrics, setMetrics] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let cancelled = false;
    setMetrics(null);
    setError('');
    request(`/api/runs/${runId}/metrics`)
      .then((response) => !cancelled && setMetrics(response.data))
      .catch((loadError) => !cancelled && setError(loadError.message));
    return () => { cancelled = true; };
  }, [refreshKey, runId]);
  if (error) return <p className="mt-5 text-xs text-rose-700">Metrics unavailable: {error}</p>;
  if (!metrics) return <p className="mt-5 text-xs text-slate-500">Calculating run metrics…</p>;
  const cards = [
    ['Deterministic coverage', percentage(metrics.deterministicCoverage)],
    ['AI fallbacks', metrics.aiFallbacks.total],
    ['Cache-hit rate', percentage(metrics.cacheHits.rate)],
    ['Average / p95', `${metrics.latencyMs.average} / ${metrics.latencyMs.p95} ms`],
    ['Token usage', metrics.tokens.total.toLocaleString()],
    ['Estimated cost', `$${metrics.estimatedCostUsd.toFixed(4)}`],
    ['Review resolution', percentage(metrics.reviews.resolutionRate)]
  ];
  return (
    <section className="mt-5 rounded-2xl border border-sky-100 bg-white p-6 shadow-sm shadow-sky-100/70">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h2 className="flex items-center gap-2 font-semibold text-slate-950"><TrendingUp className="size-4 text-blue-600" /> Run value metrics</h2><p className="mt-1 text-sm text-slate-500">Coverage, cost, latency, cache reuse, and human resolution evidence.</p></div>
        <div className="text-right text-xs text-slate-500">AI by stage: classification {metrics.aiFallbacks.byStage.classification} · roles {metrics.aiFallbacks.byStage.documentRole} · fields {metrics.aiFallbacks.byStage.documentFields}</div>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
        {cards.map(([label, value]) => <div key={label} className="rounded-xl border border-sky-100 bg-sky-50/70 p-4"><p className="text-[11px] text-slate-500">{label}</p><p className="mt-1 font-semibold text-slate-950">{value}</p></div>)}
      </div>
      <p className="mt-4 text-xs text-slate-500">{metrics.processingAttempts} processing attempt{metrics.processingAttempts === 1 ? '' : 's'} across {metrics.processed} completed emails.</p>
      {metrics.learningImpact.previousAiFallbacks !== null && <p className="mt-3 text-xs text-slate-500">Repeated-run learning impact: {metrics.learningImpact.previousAiFallbacks} → {metrics.learningImpact.currentAiFallbacks} AI calls ({percentage(metrics.learningImpact.reductionRate)} reduction).</p>}
    </section>
  );
}
