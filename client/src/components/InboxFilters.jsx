import { ListFilter, X } from 'lucide-react';

const categories = ['', 'BL_COMPARISON', 'SI_REQUEST', 'INVOICE_QUERY', 'GENERAL', 'SPAM'];
const statuses = ['', 'OK', 'MISMATCH', 'NEEDS_REVIEW'];
const reviewReasons = ['', 'wrong_doc_type', 'missing_attachment', 'unreadable', 'missing_value'];

const inputClass = 'min-h-11 rounded-xl border border-sky-200 bg-white px-3 text-sm text-slate-700 shadow-sm outline-none placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100';

function optionLabel(value, fallback) {
  return value ? value.replaceAll('_', ' ') : fallback;
}

export const emptyInboxFilters = Object.freeze({
  search: '', category: '', status: '', reviewReason: '', fileType: '', method: ''
});

export default function InboxFilters({ value, onChange, onApply, onClear }) {
  function update(key, nextValue) {
    onChange({ ...value, [key]: nextValue });
  }

  return (
    <form className="rounded-2xl border border-sky-100 bg-white p-5 shadow-sm shadow-sky-100/70" onSubmit={(event) => { event.preventDefault(); onApply(); }}>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <input
          aria-label="Search inbox"
          className={inputClass}
          placeholder="Search email, subject, sender"
          value={value.search}
          onChange={(event) => update('search', event.target.value)}
        />
        <select aria-label="Category filter" className={inputClass} value={value.category} onChange={(event) => update('category', event.target.value)}>
          {categories.map((item) => <option key={item || 'all'} value={item}>{optionLabel(item, 'All categories')}</option>)}
        </select>
        <select aria-label="Status filter" className={inputClass} value={value.status} onChange={(event) => update('status', event.target.value)}>
          {statuses.map((item) => <option key={item || 'all'} value={item}>{optionLabel(item, 'All statuses')}</option>)}
        </select>
        <select aria-label="Review reason filter" className={inputClass} value={value.reviewReason} onChange={(event) => update('reviewReason', event.target.value)}>
          {reviewReasons.map((item) => <option key={item || 'all'} value={item}>{optionLabel(item, 'All review reasons')}</option>)}
        </select>
        <select aria-label="File type filter" className={inputClass} value={value.fileType} onChange={(event) => update('fileType', event.target.value)}>
          <option value="">All file types</option>
          {['.txt', '.pdf', '.docx', '.xlsx'].map((item) => <option key={item} value={item}>{item.slice(1).toUpperCase()}</option>)}
        </select>
        <select aria-label="Decision method filter" className={inputClass} value={value.method} onChange={(event) => update('method', event.target.value)}>
          <option value="">All methods</option>
          <option value="rule">Rule</option>
          <option value="ai">AI fallback</option>
          <option value="human">Human</option>
        </select>
      </div>
      <div className="mt-4 flex gap-2">
        <button type="submit" className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-blue-600 px-4 text-xs font-semibold text-white hover:bg-blue-700"><ListFilter className="size-3.5" /> Apply filters</button>
        <button type="button" onClick={onClear} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-sky-200 bg-white px-4 text-xs font-semibold text-slate-600 hover:bg-sky-50"><X className="size-3.5" /> Clear</button>
      </div>
    </form>
  );
}
