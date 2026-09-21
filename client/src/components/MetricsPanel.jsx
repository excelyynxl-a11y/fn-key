import { useEffect, useState } from 'react';
import { request } from '../services/api.js';

function percentage(value) { return `${Math.round((value ?? 0) * 100)}%`; }

export default function MetricsPanel({ runId }) {
  const [metrics, setMetrics] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    request(`/api/runs/${runId}/metrics`).then((response) => setMetrics(response.data)).catch((loadError) => setError(loadError.message));
  }, [runId]);
  if (error) return <p className="mt-4 text-xs text-rose-700">Metrics unavailable: {error}</p>;
  if (!metrics) return <p className="mt-4 text-xs text-slate-500">Calculating run metrics…</p>;
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
    <section className="mt-4 rounded-2xl border border-cyan-200 bg-cyan-50 p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h2 className="font-semibold text-cyan-950">Run value metrics</h2><p className="mt-1 text-xs text-cyan-800">Coverage, cost, latency, cache reuse, and human resolution evidence.</p></div>
        <div className="text-right text-xs text-cyan-900">AI by stage: classification {metrics.aiFallbacks.byStage.classification} · roles {metrics.aiFallbacks.byStage.documentRole} · fields {metrics.aiFallbacks.byStage.documentFields}</div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-7">
        {cards.map(([label, value]) => <div key={label} className="rounded-lg bg-white p-3"><p className="text-[11px] text-slate-500">{label}</p><p className="mt-1 font-semibold text-slate-900">{value}</p></div>)}
      </div>
      {metrics.learningImpact.previousAiFallbacks !== null && <p className="mt-3 text-xs text-cyan-900">Repeated-run learning impact: {metrics.learningImpact.previousAiFallbacks} → {metrics.learningImpact.currentAiFallbacks} AI calls ({percentage(metrics.learningImpact.reductionRate)} reduction).</p>}
    </section>
  );
}
