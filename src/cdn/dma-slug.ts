const LEGACY_DMA_SLUG_ALIASES: Record<string, string> = {
  'grand-forks': 'great-falls',
  jayess: 'columbus-tupelo-west-point',
  laurel: 'jackson-ms',
};

/** Map catalog/bootstrap slug to the slug published on Globe CDN. */
export function canonicalDmaCdnSlug(slug: string | undefined | null): string {
  const normalized = String(slug ?? '')
    .trim()
    .toLowerCase();
  if (!normalized) return '';
  return LEGACY_DMA_SLUG_ALIASES[normalized] ?? normalized;
}

/** True when the slug differs from its CDN-published canonical form. */
export function isLegacyDmaSlug(slug: string | undefined | null): boolean {
  const normalized = String(slug ?? '')
    .trim()
    .toLowerCase();
  return Boolean(normalized && LEGACY_DMA_SLUG_ALIASES[normalized]);
}
