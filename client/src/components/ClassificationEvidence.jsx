const categories = ['BL_COMPARISON', 'SI_REQUEST', 'INVOICE_QUERY', 'GENERAL', 'SPAM'];

function display(value) {
  return value?.replaceAll('_', ' ') ?? 'Unassigned';
}

export default function ClassificationEvidence({ classification }) {
  if (!classification) return null;
  const scores = classification.scores ?? {};
  const maximum = Math.max(1, ...Object.values(scores));

  return (
    <section className="mt-5 rounded-xl border border-slate-200 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Classification evidence</p>
          <p className="mt-1 text-sm text-slate-700">{classification.reason}</p>
        </div>
        <div className="flex gap-2 text-xs">
          <span className="rounded-full bg-blue-50 px-2.5 py-1 font-semibold text-blue-700">{classification.method}</span>
          {classification.confidence != null && (
            <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-700">
              {Math.round(classification.confidence * 100)}% confidence
            </span>
          )}
          {classification.cacheHit && <span className="rounded-full bg-violet-50 px-2.5 py-1 font-semibold text-violet-700">cache hit</span>}
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-5">
        {categories.map((category) => {
          const score = scores[category] ?? 0;
          return (
            <div key={category} className="rounded-lg bg-slate-50 p-2.5">
              <div className="flex items-center justify-between gap-2 text-[11px]">
                <span className="truncate text-slate-500">{display(category)}</span>
                <strong className="text-slate-800">{score}</strong>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200">
                <div className="h-full rounded-full bg-blue-500" style={{ width: `${(score / maximum) * 100}%` }} />
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {(classification.matchedEvidence ?? classification.evidencePhrases ?? []).map((evidence, index) => {
          const phrase = typeof evidence === 'string' ? evidence : evidence.phrase;
          const location = typeof evidence === 'string' ? null : evidence.location;
          return (
            <span key={`${phrase}-${index}`} className="rounded-lg border border-blue-100 bg-blue-50 px-2.5 py-1.5 text-xs text-blue-800">
              “{phrase}”{location ? ` · ${location}` : ''}
            </span>
          );
        })}
      </div>
    </section>
  );
}
