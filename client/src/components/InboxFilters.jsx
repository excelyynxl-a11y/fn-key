import { ListFilter, X } from 'lucide-react';

const categories = ['', 'BL_COMPARISON', 'SI_REQUEST', 'INVOICE_QUERY', 'GENERAL', 'SPAM'];
const statuses = ['', 'OK', 'MISMATCH', 'NEEDS_REVIEW'];
const reviewReasons = ['', 'wrong_doc_type', 'missing_attachment', 'unreadable', 'missing_value'];

const inputClass = 'rounded-md border border-blue-800 bg-blue-950/50 px-3 py-2 text-sm text-blue-100 placeholder:text-blue-400/50 outline-none focus:border-blue-500';

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
    <form className="rounded-lg border border-blue-900/60 bg-[#0a1526] p-4 shadow-sm" onSubmit={(event) => { event.preventDefault(); onApply(); }}>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
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
      <div className="mt-3 flex gap-2">
        <button type="submit" className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-500"><ListFilter className="size-3.5" /> Apply filters</button>
        <button type="button" onClick={onClear} className="inline-flex items-center gap-1.5 rounded-md border border-blue-800 bg-blue-950/50 px-3 py-2 text-xs font-semibold text-blue-200 hover:bg-blue-900/50"><X className="size-3.5" /> Clear</button>
      </div>
    </form>
  );
}
