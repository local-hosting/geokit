import { asDmaSlugOrUndefined } from '@twinfile/geokit/core';

/** Retired bootstrap slugs → canonical Nielsen slug on FW shapes CDN. */
export const LEGACY_DMA_SLUG_ALIASES: Record<string, string> = {
  'grand-forks': 'great-falls',
  hawaii: 'honolulu',
  jayess: 'columbus-tupelo-west-point',
  laurel: 'jackson-ms',
};

const DMA_DISPLAY_LABELS: Record<string, string> = {
  'hartford-new-haven': 'Hartford & New Haven, CT',
  flagstaff: 'Flagstaff, AZ',
  'great-falls': 'Great Falls, MT',
  'jackson-ms': 'Jackson, MS',
  'puerto-rico': 'Puerto Rico',
  prescott: 'Prescott, AZ',
};

export function resolveCanonicalDmaSlug(slug: string | undefined | null): string {
  const normalized = String(slug ?? '')
    .trim()
    .toLowerCase();
  if (!normalized) return '';
  return LEGACY_DMA_SLUG_ALIASES[normalized] ?? normalized;
}

export function slugToDmaDisplayName(slug: string): string {
  const key = resolveCanonicalDmaSlug(slug);
  if (DMA_DISPLAY_LABELS[key]) return DMA_DISPLAY_LABELS[key];
  return key
    .split('-')
    .map((word) => (word ? word.charAt(0).toUpperCase() + word.slice(1) : word))
    .join(' ');
}

export function canonicalDmaSlug(slug: string | undefined | null): string {
  const resolved = resolveCanonicalDmaSlug(slug);
  if (!resolved) return '';
  return asDmaSlugOrUndefined(resolved) ?? resolved;
}
