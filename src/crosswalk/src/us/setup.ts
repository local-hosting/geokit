/**
 * US crosswalk runtime setup — table load + county boundaries for point → DMA.
 */

import { loadCrosswalk } from '../load/load';
import {
  isCrosswalkCountryLoaded,
  isCrosswalkTableLoaded,
} from '../load/registry';
import { US_CROSSWALK_PRESETS } from './table-names';
import {
  isCountyBoundariesLoaded,
  registerCountyBoundaries,
} from './county-boundaries';
import { asDmaSlugOrUndefined } from '@local-hosting/geokit/core';

export type CountyBoundaryLoader = () => Promise<GeoJSON.FeatureCollection | null>;

let countyBoundaryLoader: CountyBoundaryLoader | null = null;
let countyBoundaryInflight: Promise<void> | null = null;
let crosswalkLoadInflight: Promise<void> | null = null;

export function setCountyBoundaryLoader(loader: CountyBoundaryLoader | null): void {
  countyBoundaryLoader = loader;
}

async function ensureCountyBoundariesLoaded(): Promise<void> {
  if (isCountyBoundariesLoaded() || !countyBoundaryLoader) return;
  if (!countyBoundaryInflight) {
    countyBoundaryInflight = countyBoundaryLoader()
      .then((collection) => {
        if (collection) registerCountyBoundaries(collection);
      })
      .finally(() => {
        countyBoundaryInflight = null;
      });
  }
  await countyBoundaryInflight;
}

export async function ensureUsCrosswalkLoaded(): Promise<void> {
  const tablesReady =
    isCrosswalkCountryLoaded('us') &&
    isCrosswalkTableLoaded('countyToDma');

  if (!tablesReady) {
    if (!crosswalkLoadInflight) {
      crosswalkLoadInflight = loadCrosswalk('us', {
        tables: [...US_CROSSWALK_PRESETS.dma, 'countyToDma'],
        projectH3: false,
      }).finally(() => {
        crosswalkLoadInflight = null;
      });
    }
    await crosswalkLoadInflight;
  }

  await ensureCountyBoundariesLoaded();
}

export function isUsCrosswalkLoaded(): boolean {
  return isCrosswalkCountryLoaded('us') && isCountyBoundariesLoaded();
}

export function mergeDmaSlugList(
  ...parts: Array<string | null | undefined>
): string {
  const merged = new Set<string>();
  for (const part of parts) {
    for (const raw of (part ?? '').split(',')) {
      const slug = asDmaSlugOrUndefined(raw);
      if (slug) merged.add(slug);
    }
  }
  return [...merged].sort().join(',');
}

export {
  clearCountyBoundaries,
  isCountyBoundariesLoaded,
  registerCountyBoundaries,
} from './county-boundaries';
