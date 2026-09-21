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
  if (!field?.rawValue) return <span className="text-amber-300">Missing</span>;
  const location = [
    field.location?.page ? `page ${field.location.page}` : null,
    field.location?.sheet ? `sheet ${field.location.sheet}` : null,
    field.location?.cell ? `cell ${field.location.cell}` : null,
    field.location?.line ? `line ${field.location.line}` : null
  ].filter(Boolean).join(' · ') || 'location unavailable';
  return (
    <div>
      <p className="font-medium text-white">{field.rawValue}</p>
      <p className="mt-1 text-xs text-blue-300/60">Normalized: <span className="font-mono">{String(field.normalizedValue ?? 'unresolved')}</span></p>
      <p className="mt-1 text-[11px] uppercase tracking-wide text-blue-400/60">
        {field.method === 'ai' ? 'AI fallback' : 'Deterministic extraction'} · {Math.round((field.confidence ?? 0) * 100)}%
      </p>
      <details className="mt-2 text-xs text-blue-300/70">
        <summary className="cursor-pointer font-medium text-blue-300">Source evidence</summary>
        <p className="mt-1 rounded-sm bg-blue-950/60 p-2 text-blue-200/80">{field.evidence}</p>
        <p className="mt-1">{location}</p>
      </details>
    </div>
  );
}

export default function FieldComparisonTable({ email }) {
  const siFields = email.documents?.si?.fields ?? {};
  const blFields = email.documents?.bl?.fields ?? {};
  const defects = new Set(email.result?.defectFields ?? []);

  return (
    <div className="overflow-x-auto rounded-md border border-blue-900/60 bg-[#0a1526]">
      <table className="w-full min-w-[700px] text-left text-sm">
        <thead className="bg-blue-950/70 text-xs uppercase tracking-wide text-blue-300/70">
          <tr>
            <th className="px-4 py-3">Field</th>
            <th className="px-4 py-3">Shipping instruction</th>
            <th className="px-4 py-3">Draft bill of lading</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-blue-900/40">
          {fields.map(([key, label]) => (
            <tr key={key} className={defects.has(key) ? 'bg-rose-950/30' : ''}>
              <th className="px-4 py-4 align-top font-semibold text-blue-100">
                {label}
                <span className={`ml-2 text-xs ${defects.has(key) ? 'text-rose-300' : (!siFields[key]?.rawValue || !blFields[key]?.rawValue) ? 'text-amber-300' : 'text-emerald-300'}`}>
                  {defects.has(key) ? 'Mismatch' : (!siFields[key]?.rawValue || !blFields[key]?.rawValue) ? 'Unresolved' : 'Match'}
                </span>
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
