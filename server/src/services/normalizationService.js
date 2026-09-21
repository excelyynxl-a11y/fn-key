function normalizeWords(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .toUpperCase()
    .replace(/[.,;:()[\]{}'"`]/g, ' ')
    .replace(/[\/_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const PORT_ALIASES = new Map([
  ['NHAVA SHEVA INDIA', 'INNSA'],
  ['CONAKRY GUINEA', 'GNCKY'],
  ['NANTONG CHINA', 'CNNTG'],
  ['BUATAN INDONESIA', 'IDBUA'],
  ['BUSAN SOUTH KOREA', 'KRPUS'],
  ['SINGAPORE', 'SGSIN'],
  ['PYEONGTAEK SOUTH KOREA', 'KRPTK'],
  ['APAPA NIGERIA', 'NGAPP'],
  ['CALLAO PERU', 'PECLL']
]);

function isPlaceholder(value) {
  return /^(?:N\s*\/?\s*A|TBA|TBD|UNKNOWN|[-_?\s]+)$/i.test(String(value ?? '').trim());
}

export function normalizeParty(value) {
  if (isPlaceholder(value)) return null;
  return normalizeWords(value) || null;
}

export function normalizePort(value) {
  if (isPlaceholder(value)) return null;
  const locode = String(value ?? '').toUpperCase().match(/\(([A-Z]{5})\)/)?.[1];
  const normalized = normalizeWords(value);
  return (locode ?? PORT_ALIASES.get(normalized) ?? normalized) || null;
}

export function normalizeContainerCount(value) {
  const text = String(value ?? '');
  if (isPlaceholder(text)) return null;
  const explicitCounts = [...text.matchAll(/(\d+)\s*[xX×]\s*(?=\d|[A-Z'])/gi)]
    .map((match) => Number.parseInt(match[1], 10));
  if (explicitCounts.length > 0) return explicitCounts.reduce((sum, count) => sum + count, 0);
  const standalone = text.match(/^\s*(\d+)\s*(?:containers?|units?)?\s*$/i)?.[1];
  return standalone === undefined ? null : Number.parseInt(standalone, 10);
}

export function normalizeGrossWeightKg(value) {
  const text = String(value ?? '').replace(/,/g, '').trim();
  const match = text.match(/^(-?\d+(?:\.\d+)?)\s*(KG|KGS|KILOGRAMS?|MT|MTS|TONS?|TONNES?)?\.?$/i);
  if (!match) return null;
  const amount = Number.parseFloat(match[1]);
  if (!Number.isFinite(amount) || amount < 0) return null;
  const unit = (match[2] ?? 'KG').toUpperCase();
  const kilograms = /^(MT|MTS|TON|TONS|TONNE|TONNES)$/.test(unit) ? amount * 1000 : amount;
  return Number.isInteger(kilograms) ? kilograms : Number(kilograms.toFixed(3));
}

export const FIELD_NORMALIZERS = Object.freeze({
  shipper: normalizeParty,
  consignee: normalizeParty,
  notify_party: normalizeParty,
  port_of_loading: normalizePort,
  port_of_discharge: normalizePort,
  container_count: normalizeContainerCount,
  gross_weight_kg: normalizeGrossWeightKg
});

