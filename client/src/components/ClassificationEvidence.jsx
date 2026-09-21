import { Brain, Sparkles } from 'lucide-react';

const categories = ['BL_COMPARISON', 'SI_REQUEST', 'INVOICE_QUERY', 'GENERAL', 'SPAM'];

function display(value) {
  return value?.replaceAll('_', ' ') ?? 'Unassigned';
}

export default function ClassificationEvidence({ classification }) {
  if (!classification) return null;
  const scores = classification.scores ?? {};
  const maximum = Math.max(1, ...Object.values(scores));

  return (
    <section className="mt-6 rounded-xl border border-sky-100 bg-sky-50/60 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-blue-600"><Brain className="size-3.5" /> Classification evidence</p>
          <p className="mt-2 text-sm text-slate-600">{classification.reason}</p>
        </div>
        <div className="flex gap-2 text-xs">
          <span className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 font-semibold text-blue-700"><Sparkles className="size-3" /> {classification.method}</span>
          {classification.confidence != null && (
            <span className="rounded-lg border border-sky-200 bg-white px-2.5 py-1 font-semibold text-slate-600">
              {Math.round(classification.confidence * 100)}% confidence
            </span>
          )}
          {classification.cacheHit && <span className="rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-1 font-semibold text-violet-700">cache hit</span>}
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-5">
        {categories.map((category) => {
          const score = scores[category] ?? 0;
          return (
            <div key={category} className="rounded-lg border border-sky-100 bg-white p-3">
              <div className="flex items-center justify-between gap-2 text-[11px]">
                <span className="truncate text-slate-500">{display(category)}</span>
                <strong className="text-slate-900">{score}</strong>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-sky-100">
                <div className="h-full rounded-sm bg-blue-500" style={{ width: `${(score / maximum) * 100}%` }} />
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
            <span key={`${phrase}-${index}`} className="max-w-full break-words rounded-lg border border-sky-200 bg-white px-2.5 py-1.5 text-xs text-slate-600">
              “{phrase}”{location ? ` · ${location}` : ''}
            </span>
          );
        })}
      </div>
    </section>
  );
}
