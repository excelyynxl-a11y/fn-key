import { ListChecks } from 'lucide-react';

export default function ReviewQueue({ reviews = [], grouped = {}, onSelect, selectedEmailId }) {
  return (
    <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div><h2 className="flex items-center gap-2 font-semibold text-amber-950"><ListChecks className="size-4 text-amber-600" /> Review queue</h2><p className="mt-1 text-sm text-amber-800">{reviews.length} unresolved cases grouped by reason.</p></div>
        <div className="flex flex-wrap justify-end gap-1 text-[11px] text-amber-800">
          {Object.entries(grouped).map(([reason, count]) => <span key={reason} className="rounded-lg border border-amber-200 bg-white px-2.5 py-1.5">{reason.replaceAll('_', ' ')} · {count}</span>)}
        </div>
      </div>
      <div className="mt-3 flex max-h-36 flex-wrap gap-2 overflow-auto">
        {reviews.map((review) => (
          <button type="button" key={review.reviewId} onClick={() => onSelect(review.emailId)} className={`rounded-xl border px-3 py-2 text-left text-xs ${selectedEmailId === review.emailId ? 'border-amber-500 bg-amber-500 text-white' : 'border-amber-200 bg-white text-amber-950 hover:bg-amber-100'}`}>
            <strong>{review.emailId}</strong><span className="ml-1 opacity-75">{review.reviewReason.replaceAll('_', ' ')}</span>
          </button>
        ))}
        {reviews.length === 0 && <p className="text-xs text-amber-700">No unresolved reviews.</p>}
      </div>
    </section>
  );
}
