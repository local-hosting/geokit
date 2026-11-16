import {
  asDMA,
  asDmaSlugOrUndefined,
  asMacroRegion,
  asMacroRegionOrUndefined,
  type DMA,
} from '@doppler-group/geokit/core';

export { asDmaSlugOrUndefined as canonicalDmaSlug } from '@doppler-group/geokit/core';

export function toDMA(
  slug: string | undefined,
  regionHint?: string | null
): DMA | undefined {
  const canonical = asDmaSlugOrUndefined(slug);
  if (!canonical) return undefined;
  const region =
    asMacroRegionOrUndefined(regionHint ?? undefined) ?? asMacroRegion('unknown');
  return asDMA(canonical, region);
}

export function toDMAList(
  slug: string | undefined,
  regionHint?: string | null
): readonly DMA[] {
  const dma = toDMA(slug, regionHint);
  return dma ? [dma] : [];
}
