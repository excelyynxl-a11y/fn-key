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
    <section className="mt-5 rounded-md border border-blue-900/60 bg-[#0a1526] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-blue-300/60"><Brain className="size-3.5" /> Classification evidence</p>
          <p className="mt-1 text-sm text-blue-200/80">{classification.reason}</p>
        </div>
        <div className="flex gap-2 text-xs">
          <span className="inline-flex items-center gap-1 rounded-md border border-blue-800 bg-blue-900/50 px-2.5 py-1 font-semibold text-blue-200"><Sparkles className="size-3" /> {classification.method}</span>
          {classification.confidence != null && (
            <span className="rounded-md border border-blue-800 bg-blue-950/70 px-2.5 py-1 font-semibold text-blue-200">
              {Math.round(classification.confidence * 100)}% confidence
            </span>
          )}
          {classification.cacheHit && <span className="rounded-md border border-violet-800 bg-violet-950/60 px-2.5 py-1 font-semibold text-violet-300">cache hit</span>}
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-5">
        {categories.map((category) => {
          const score = scores[category] ?? 0;
          return (
            <div key={category} className="rounded-md bg-blue-950/50 p-2.5">
              <div className="flex items-center justify-between gap-2 text-[11px]">
                <span className="truncate text-blue-300/60">{display(category)}</span>
                <strong className="text-white">{score}</strong>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-sm bg-blue-900/60">
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
            <span key={`${phrase}-${index}`} className="rounded-md border border-blue-800 bg-blue-950/60 px-2.5 py-1.5 text-xs text-blue-200">
              “{phrase}”{location ? ` · ${location}` : ''}
            </span>
          );
        })}
      </div>
    </section>
  );
}
