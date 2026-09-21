function normalizeWords(value) {
  return value
    .normalize('NFKC')
    .toUpperCase()
    .replace(/[.,;:()[\]{}]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeParty(value) {
  return normalizeWords(value);
}

export function normalizePort(value) {
  const locode = value.toUpperCase().match(/\(([A-Z]{5})\)/)?.[1];
  return locode ?? normalizeWords(value);
}

export function normalizeContainerCount(value) {
  const count = value.match(/(\d+)\s*[xX×]/)?.[1] ?? value.match(/\d+/)?.[0];
  return count === undefined ? null : Number.parseInt(count, 10);
}

export function normalizeGrossWeightKg(value) {
  const match = value.replace(/,/g, '').match(/(-?\d+(?:\.\d+)?)\s*(KG|KGS|KILOGRAMS?|MT|MTS|TONS?|TONNES?)?/i);
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

