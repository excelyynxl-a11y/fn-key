function eventLabel(event) {
  return event.eventType?.replaceAll('.', ' · ').replaceAll('_', ' ') ?? 'Processing event';
}

function eventSummary(event) {
  const details = event.details ?? {};
  if (event.eventType === 'email.processing.completed') {
    return `${details.classificationMethod ?? 'unknown'} classification · ${details.status ?? 'unknown result'}${details.classificationCacheHit ? ' · cache hit' : ''}`;
  }
  if (event.eventType === 'review.corrected') return `${details.reviewer ?? 'Reviewer'} corrected the source-derived result · ${details.nextResult?.status ?? 'reprocessed'}`;
  if (event.eventType === 'review.confirmed') return `${details.reviewer ?? 'Reviewer'} confirmed the existing result`;
  if (event.eventType === 'review.reopened') return `${details.reviewer ?? 'Reviewer'} reopened the case · ${details.reason}`;
  if (event.eventType === 'email.retry.completed') return `${details.status ?? 'unknown result'}${details.reviewReason ? ` · ${details.reviewReason.replaceAll('_', ' ')}` : ''}`;
  if (event.eventType?.startsWith('knowledge.')) return `${details.phrase ?? 'Knowledge entry'} · ${details.status ?? event.eventType.split('.').pop()}`;
  if (event.eventType === 'email.processing.failed') return `${details.code}: ${details.message}`;
  return details.retry ? 'Retry requested' : 'Processing started';
}

export default function ProcessingTimeline({ events = [] }) {
  if (events.length === 0) return null;
  return (
    <section className="mt-5 rounded-md border border-blue-900/60 bg-[#0a1526] p-4">
      <h3 className="text-sm font-semibold text-white">Processing timeline</h3>
      <ol className="mt-3 space-y-3 border-l border-blue-900/60 pl-4">
        {events.map((event) => (
          <li key={event._id ?? `${event.eventType}-${event.createdAt}`} className="relative">
            <span className="absolute -left-[21px] top-1 size-2.5 rounded-full bg-blue-500 ring-4 ring-[#0a1526]" />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-100">{eventLabel(event)}</p>
              <time className="text-[11px] text-blue-400/60">{event.createdAt ? new Date(event.createdAt).toLocaleString() : ''}</time>
            </div>
            <p className="mt-1 text-xs text-blue-300/70">{eventSummary(event)}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
