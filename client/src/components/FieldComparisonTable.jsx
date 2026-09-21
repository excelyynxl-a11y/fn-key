const fields = [
  ['shipper', 'Shipper'],
  ['consignee', 'Consignee'],
  ['notify_party', 'Notify party'],
  ['port_of_loading', 'Port of loading'],
  ['port_of_discharge', 'Port of discharge'],
  ['container_count', 'Container count'],
  ['gross_weight_kg', 'Gross weight (kg)']
];

function FieldValue({ field }) {
  if (!field?.rawValue) return <span className="text-amber-700">Missing</span>;
  const location = [
    field.location?.page ? `page ${field.location.page}` : null,
    field.location?.sheet ? `sheet ${field.location.sheet}` : null,
    field.location?.cell ? `cell ${field.location.cell}` : null,
    field.location?.line ? `line ${field.location.line}` : null
  ].filter(Boolean).join(' · ') || 'location unavailable';
  return (
    <div>
      <p className="font-medium text-slate-900">{field.rawValue}</p>
      <p className="mt-1 text-xs text-slate-500">{field.evidence} · {location}</p>
      <p className="mt-1 text-[11px] uppercase tracking-wide text-slate-400">
        {field.method === 'ai' ? 'AI fallback' : 'Deterministic extraction'} · {Math.round((field.confidence ?? 0) * 100)}%
      </p>
    </div>
  );
}

export default function FieldComparisonTable({ email }) {
  const siFields = email.documents?.si?.fields ?? {};
  const blFields = email.documents?.bl?.fields ?? {};
  const defects = new Set(email.result?.defectFields ?? []);

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="w-full min-w-[700px] text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3">Field</th>
            <th className="px-4 py-3">Shipping instruction</th>
            <th className="px-4 py-3">Draft bill of lading</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {fields.map(([key, label]) => (
            <tr key={key} className={defects.has(key) ? 'bg-rose-50' : ''}>
              <th className="px-4 py-4 align-top font-semibold text-slate-700">
                {label}
                {defects.has(key) && <span className="ml-2 text-xs text-rose-600">Mismatch</span>}
              </th>
              <td className="px-4 py-4 align-top"><FieldValue field={siFields[key]} /></td>
              <td className="px-4 py-4 align-top"><FieldValue field={blFields[key]} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

