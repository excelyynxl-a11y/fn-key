const categories = ['', 'BL_COMPARISON', 'SI_REQUEST', 'INVOICE_QUERY', 'GENERAL', 'SPAM'];
const statuses = ['', 'OK', 'MISMATCH', 'NEEDS_REVIEW'];
const reviewReasons = ['', 'wrong_doc_type', 'missing_attachment', 'unreadable', 'missing_value'];

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
    <form className="rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm" onSubmit={(event) => { event.preventDefault(); onApply(); }}>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        <input
          aria-label="Search inbox"
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500"
          placeholder="Search email, subject, sender"
          value={value.search}
          onChange={(event) => update('search', event.target.value)}
        />
        <select aria-label="Category filter" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" value={value.category} onChange={(event) => update('category', event.target.value)}>
          {categories.map((item) => <option key={item || 'all'} value={item}>{optionLabel(item, 'All categories')}</option>)}
        </select>
        <select aria-label="Status filter" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" value={value.status} onChange={(event) => update('status', event.target.value)}>
          {statuses.map((item) => <option key={item || 'all'} value={item}>{optionLabel(item, 'All statuses')}</option>)}
        </select>
        <select aria-label="Review reason filter" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" value={value.reviewReason} onChange={(event) => update('reviewReason', event.target.value)}>
          {reviewReasons.map((item) => <option key={item || 'all'} value={item}>{optionLabel(item, 'All review reasons')}</option>)}
        </select>
        <select aria-label="File type filter" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" value={value.fileType} onChange={(event) => update('fileType', event.target.value)}>
          <option value="">All file types</option>
          {['.txt', '.pdf', '.docx', '.xlsx'].map((item) => <option key={item} value={item}>{item.slice(1).toUpperCase()}</option>)}
        </select>
        <select aria-label="Decision method filter" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" value={value.method} onChange={(event) => update('method', event.target.value)}>
          <option value="">All methods</option>
          <option value="rule">Rule</option>
          <option value="ai">AI fallback</option>
          <option value="human">Human</option>
        </select>
      </div>
      <div className="mt-3 flex gap-2">
        <button type="submit" className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700">Apply filters</button>
        <button type="button" onClick={onClear} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100">Clear</button>
      </div>
    </form>
  );
}
