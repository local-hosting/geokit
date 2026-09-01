function trimLower(raw: string): string {
  return raw.trim().toLowerCase();
}

export function normalizeKebabSlug(raw: string | null | undefined): string | undefined {
  if (!raw) return undefined;
  const slug = trimLower(raw).replace(/\s+/g, '-');
  return slug || undefined;
}

export function normalizeZipDigits(raw: string | null | undefined): string | undefined {
  if (!raw) return undefined;
  const digits = raw.trim().replace(/\D/g, '');
  if (!digits) return undefined;
  return digits.padStart(5, '0').slice(-5);
}

export function normalizeCountyFipsDigits(raw: string | null | undefined): string | undefined {
  if (!raw) return undefined;
  const digits = raw.trim().replace(/\D/g, '');
  if (!digits) return undefined;
  return digits.padStart(5, '0').slice(-5);
}

export function normalizeStateCode(raw: string | null | undefined): string | undefined {
  if (!raw) return undefined;
  const code = trimLower(raw);
  return code.length === 2 ? code : undefined;
}

export function normalizePlaceKey(raw: string | null | undefined): string | undefined {
  const key = normalizeKebabSlug(raw);
  return key?.includes('/') ? key : undefined;
}

export function placeKeyFromStateAndSlug(
  state: string | null | undefined,
  placeSlug: string | null | undefined
): string | undefined {
  const stateCode = normalizeStateCode(state);
  const slug = normalizeKebabSlug(placeSlug);
  if (!stateCode || !slug) return undefined;
  return `${stateCode}/${slug}`;
}
