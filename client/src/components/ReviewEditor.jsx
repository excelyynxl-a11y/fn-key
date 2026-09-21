import { useMemo, useState } from 'react';
import { CheckCheck, Eye, PencilLine, Save } from 'lucide-react';
import { request } from '../services/api.js';

const categories = ['BL_COMPARISON', 'SI_REQUEST', 'INVOICE_QUERY', 'GENERAL', 'SPAM'];
const fields = ['shipper', 'consignee', 'notify_party', 'port_of_loading', 'port_of_discharge', 'container_count', 'gross_weight_kg'];

const controlClass = 'min-h-11 rounded-xl border border-amber-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100';

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
  const [learn, setLearn] = useState(false);
  const [learningPhrase, setLearningPhrase] = useState('');
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
        body: JSON.stringify({
          action, preview: previewOnly, expectedVersion: review.__v, note,
          corrections: action === 'correct' ? corrections : undefined,
          knowledgeUpdate: action === 'correct' && learn ? { enabled: true, phrase: learningPhrase } : { enabled: false }
        })
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
    <section className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div><h3 className="flex items-center gap-2 text-sm font-semibold text-amber-950"><PencilLine className="size-4 text-amber-600" /> Resolve review</h3><p className="mt-1 text-xs text-amber-700">{review.reviewReason.replaceAll('_', ' ')} · {review.stage.replaceAll('_', ' ')}</p></div>
        <select className={controlClass} value={correctionType} onChange={(event) => setCorrectionType(event.target.value)}>
          <option value="field">Correct a field</option><option value="category">Correct category</option><option value="roles">Correct SI/BL roles</option>
        </select>
      </div>
      {correctionType === 'category' && <select className={`mt-3 w-full ${controlClass}`} value={category} onChange={(event) => setCategory(event.target.value)}>{categories.map((item) => <option key={item}>{item}</option>)}</select>}
      {correctionType === 'field' && (
        <div className="mt-3 grid gap-2 sm:grid-cols-[100px_1fr_1fr]">
          <select className={controlClass} value={documentType} onChange={(event) => setDocumentType(event.target.value)}><option>SI</option><option>BL</option></select>
          <select className={controlClass} value={field} onChange={(event) => setField(event.target.value)}>{fields.map((item) => <option key={item}>{item.replaceAll('_', ' ')}</option>)}</select>
          <input className={controlClass} placeholder="Correct value" value={rawValue} onChange={(event) => setRawValue(event.target.value)} />
        </div>
      )}
      {correctionType === 'roles' && (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <label className="text-xs text-amber-800">Shipping instruction<select className={`mt-1 w-full ${controlClass}`} value={siReference} onChange={(event) => setSiReference(event.target.value)}>{attachments.map((item) => <option key={item.reference} value={item.reference}>{item.filename}</option>)}</select></label>
          <label className="text-xs text-amber-800">Bill of lading<select className={`mt-1 w-full ${controlClass}`} value={blReference} onChange={(event) => setBlReference(event.target.value)}>{attachments.map((item) => <option key={item.reference} value={item.reference}>{item.filename}</option>)}</select></label>
        </div>
      )}
      <textarea className={`mt-3 min-h-20 w-full ${controlClass}`} placeholder="Required reviewer note explaining the decision" value={note} onChange={(event) => setNote(event.target.value)} />
      {correctionType === 'category' && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-white p-4 text-xs text-slate-600">
          <label className="flex items-center gap-2"><input type="checkbox" checked={learn} onChange={(event) => setLearn(event.target.checked)} />Add a reversible probation phrase from this correction</label>
          {learn && <input className="mt-3 min-h-11 w-full rounded-xl border border-amber-200 bg-white px-3 text-slate-700" placeholder="Exact category-specific phrase from subject or body" value={learningPhrase} onChange={(event) => setLearningPhrase(event.target.value)} />}
        </div>
      )}
      {preview && <p className="mt-3 rounded-xl border border-amber-200 bg-white p-3 text-xs text-slate-600">Preview: <strong className="text-slate-950">{preview.status}</strong>{preview.reviewReason ? ` · ${preview.reviewReason.replaceAll('_', ' ')}` : ''}{preview.defectFields?.length ? ` · ${preview.defectFields.join(', ')}` : ''}</p>}
      {error && <p className="mt-2 text-xs text-rose-700">{error}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" disabled={busy || note.trim().length < 3} onClick={() => submit(true)} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-amber-300 bg-white px-4 text-xs font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-40"><Eye className="size-3.5" /> Preview correction</button>
        <button type="button" disabled={busy || note.trim().length < 3} onClick={() => submit(false)} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-amber-600 px-4 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-40"><Save className="size-3.5" /> Save and reprocess</button>
        <button type="button" disabled={busy || note.trim().length < 3} onClick={() => submit(false, 'confirm')} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-sky-200 bg-white px-4 text-xs font-semibold text-blue-700 hover:bg-sky-50 disabled:opacity-40"><CheckCheck className="size-3.5" /> Confirm existing review</button>
      </div>
    </section>
  );
}
