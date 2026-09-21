import { ListChecks } from 'lucide-react';

export default function ReviewQueue({ reviews = [], grouped = {}, onSelect, selectedEmailId }) {
  return (
    <section className="rounded-lg border border-amber-900/60 bg-amber-950/30 p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div><h2 className="flex items-center gap-2 font-semibold text-amber-200"><ListChecks className="size-4" /> Review queue</h2><p className="mt-1 text-xs text-amber-300/80">{reviews.length} unresolved cases grouped by reason.</p></div>
        <div className="flex flex-wrap justify-end gap-1 text-[11px] text-amber-200">
          {Object.entries(grouped).map(([reason, count]) => <span key={reason} className="rounded-md border border-amber-800 bg-amber-950/60 px-2 py-1">{reason.replaceAll('_', ' ')} · {count}</span>)}
        </div>
      </div>
      <div className="mt-3 flex max-h-36 flex-wrap gap-2 overflow-auto">
        {reviews.map((review) => (
          <button type="button" key={review.reviewId} onClick={() => onSelect(review.emailId)} className={`rounded-md border px-2.5 py-1.5 text-left text-xs ${selectedEmailId === review.emailId ? 'border-amber-500 bg-amber-900/60 text-white' : 'border-amber-800 bg-amber-950/40 text-amber-100 hover:bg-amber-900/50'}`}>
            <strong>{review.emailId}</strong><span className="ml-1 text-amber-300/80">{review.reviewReason.replaceAll('_', ' ')}</span>
          </button>
        ))}
        {reviews.length === 0 && <p className="text-xs text-amber-300/70">No unresolved reviews.</p>}
      </div>
    </section>
  );
}
