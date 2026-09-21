import { useMemo, useState } from 'react';
import { request } from '../services/api.js';

const categories = ['BL_COMPARISON', 'SI_REQUEST', 'INVOICE_QUERY', 'GENERAL', 'SPAM'];
const fields = ['shipper', 'consignee', 'notify_party', 'port_of_loading', 'port_of_discharge', 'container_count', 'gross_weight_kg'];

export default function ReviewEditor({ review, email, onComplete }) {
  const attachments = email.source?.attachments ?? [];
  const [correctionType, setCorrectionType] = useState('field');
  const [category, setCategory] = useState(email.result?.category ?? 'BL_COMPARISON');
  const [documentType, setDocumentType] = useState('SI');
  const [field, setField] = useState('shipper');
  const [rawValue, setRawValue] = useState('');
  const [siReference, setSiReference] = useState(attachments[0]?.reference ?? '');
  const [blReference, setBlReference] = useState(attachments[1]?.reference ?? '');
  const [note, setNote] = useState('');
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const corrections = useMemo(() => {
    if (correctionType === 'category') return { category };
    if (correctionType === 'roles') return { roles: { siAttachmentReference: siReference, blAttachmentReference: blReference } };
    return { fields: [{ documentType, field, rawValue }] };
  }, [blReference, category, correctionType, documentType, field, rawValue, siReference]);

  async function submit(previewOnly, action = 'correct') {
    setBusy(true);
    setError('');
    try {
      const body = await request(`/api/reviews/${review.reviewId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, preview: previewOnly, note, corrections: action === 'correct' ? corrections : undefined })
      });
      setPreview(body.data.preview);
      if (!previewOnly) onComplete(body.data);
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-5 rounded-xl border border-amber-300 bg-amber-50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div><h3 className="text-sm font-semibold text-amber-950">Resolve review</h3><p className="text-xs text-amber-800">{review.reviewReason.replaceAll('_', ' ')} · {review.stage.replaceAll('_', ' ')}</p></div>
        <select className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm" value={correctionType} onChange={(event) => setCorrectionType(event.target.value)}>
          <option value="field">Correct a field</option><option value="category">Correct category</option><option value="roles">Correct SI/BL roles</option>
        </select>
      </div>
      {correctionType === 'category' && <select className="mt-3 w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm" value={category} onChange={(event) => setCategory(event.target.value)}>{categories.map((item) => <option key={item}>{item}</option>)}</select>}
      {correctionType === 'field' && (
        <div className="mt-3 grid gap-2 sm:grid-cols-[100px_1fr_1fr]">
          <select className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm" value={documentType} onChange={(event) => setDocumentType(event.target.value)}><option>SI</option><option>BL</option></select>
          <select className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm" value={field} onChange={(event) => setField(event.target.value)}>{fields.map((item) => <option key={item}>{item.replaceAll('_', ' ')}</option>)}</select>
          <input className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm" placeholder="Correct value" value={rawValue} onChange={(event) => setRawValue(event.target.value)} />
        </div>
      )}
      {correctionType === 'roles' && (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <label className="text-xs text-amber-900">Shipping instruction<select className="mt-1 w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm" value={siReference} onChange={(event) => setSiReference(event.target.value)}>{attachments.map((item) => <option key={item.reference} value={item.reference}>{item.filename}</option>)}</select></label>
          <label className="text-xs text-amber-900">Bill of lading<select className="mt-1 w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm" value={blReference} onChange={(event) => setBlReference(event.target.value)}>{attachments.map((item) => <option key={item.reference} value={item.reference}>{item.filename}</option>)}</select></label>
        </div>
      )}
      <textarea className="mt-3 min-h-20 w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm" placeholder="Required reviewer note explaining the decision" value={note} onChange={(event) => setNote(event.target.value)} />
      {preview && <p className="mt-2 rounded-lg bg-white p-2 text-xs text-slate-700">Preview: <strong>{preview.status}</strong>{preview.reviewReason ? ` · ${preview.reviewReason.replaceAll('_', ' ')}` : ''}{preview.defectFields?.length ? ` · ${preview.defectFields.join(', ')}` : ''}</p>}
      {error && <p className="mt-2 text-xs text-rose-700">{error}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" disabled={busy || note.trim().length < 3} onClick={() => submit(true)} className="rounded-lg border border-amber-400 bg-white px-3 py-2 text-xs font-semibold text-amber-900 disabled:opacity-40">Preview correction</button>
        <button type="button" disabled={busy || note.trim().length < 3} onClick={() => submit(false)} className="rounded-lg bg-amber-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40">Save and reprocess</button>
        <button type="button" disabled={busy || note.trim().length < 3} onClick={() => submit(false, 'confirm')} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-40">Confirm existing review</button>
      </div>
    </section>
  );
}
