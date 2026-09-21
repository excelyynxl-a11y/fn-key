export default function ReviewQueue({ reviews = [], grouped = {}, onSelect, selectedEmailId }) {
  return (
    <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div><h2 className="font-semibold text-amber-950">Review queue</h2><p className="mt-1 text-xs text-amber-800">{reviews.length} unresolved cases grouped by reason.</p></div>
        <div className="flex flex-wrap justify-end gap-1 text-[11px] text-amber-900">
          {Object.entries(grouped).map(([reason, count]) => <span key={reason} className="rounded-full bg-white px-2 py-1">{reason.replaceAll('_', ' ')} · {count}</span>)}
        </div>
      </div>
      <div className="mt-3 flex max-h-36 flex-wrap gap-2 overflow-auto">
        {reviews.map((review) => (
          <button type="button" key={review.reviewId} onClick={() => onSelect(review.emailId)} className={`rounded-lg border px-2.5 py-1.5 text-left text-xs ${selectedEmailId === review.emailId ? 'border-amber-600 bg-amber-200' : 'border-amber-200 bg-white hover:bg-amber-100'}`}>
            <strong>{review.emailId}</strong><span className="ml-1 text-amber-700">{review.reviewReason.replaceAll('_', ' ')}</span>
          </button>
        ))}
        {reviews.length === 0 && <p className="text-xs text-amber-800">No unresolved reviews.</p>}
      </div>
    </section>
  );
}
