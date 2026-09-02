import {
  asDMA,
  asDmaSlugOrUndefined,
  asMacroRegion,
  asMacroRegionOrUndefined,
  type DMA,
} from '@twinfile/geokit/core';
import type { UsTableLookups } from '../us/tables';

export { asDmaSlugOrUndefined as canonicalDmaSlug } from '@twinfile/geokit/core';

export function toDMA(
  lookups: UsTableLookups,
  slug: string | undefined,
  regionHint?: string | null
): DMA | undefined {
  const canonical = asDmaSlugOrUndefined(slug);
  if (!canonical) return undefined;
  const region =
    asMacroRegionOrUndefined(regionHint ?? undefined) ??
    asMacroRegionOrUndefined(lookups.regionForDMA(canonical)) ??
    asMacroRegion('unknown');
  return asDMA(canonical, region);
}

export function toDMAList(
  lookups: UsTableLookups,
  slug: string | undefined,
  regionHint?: string | null
): readonly DMA[] {
  const dma = toDMA(lookups, slug, regionHint);
  return dma ? [dma] : [];
}
