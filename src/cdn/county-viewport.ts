/**
 * County outline helpers — viewport loads via `/cell/{cellId}.json` (`layers.county`).
 */

import type { ViewportBounds } from '../utils/h3/viewport';
import { boundsFromFeature } from './bounds';
import { fetchStatesBulkGeoJson } from './bulk';
import { createCellLayerLoader } from './cell-layers';
import type { GlobeCdnFetchOptions } from './fetch';

export type CountyViewportLoaderOptions = GlobeCdnFetchOptions & {
  getRequestInit?: () => RequestInit;
};

function boundsTupleIntersectsViewport(
  bounds: ViewportBounds,
  tuple: [number, number, number, number]
): boolean {
  const [west, south, east, north] = tuple;
  return (
    bounds.west <= east && bounds.east >= west && bounds.south <= north && bounds.north >= south
  );
}

export function resolveStateCodesForViewportBounds(
  states: GeoJSON.FeatureCollection,
  bounds: ViewportBounds
): string[] {
  const codes = new Set<string>();

  for (const feature of states.features) {
    const stateCode = String(
      (feature.properties as { stateCode?: string } | undefined)?.stateCode ?? ''
    )
      .trim()
      .toLowerCase();
    if (!stateCode) continue;

    const featureBounds = boundsFromFeature(feature);
    if (!featureBounds) continue;
    if (boundsTupleIntersectsViewport(bounds, featureBounds)) {
      codes.add(stateCode);
    }
  }

  return [...codes].sort();
}

export function mergeCountyFeaturesByFips(
  target: Map<string, GeoJSON.Feature>,
  collection: GeoJSON.FeatureCollection
): number {
  let added = 0;
  for (const feature of collection.features) {
    const fips = String(
      (feature.properties as { fips?: string } | undefined)?.fips ?? feature.id ?? ''
    )
      .trim()
      .padStart(5, '0');
    if (!fips || target.has(fips)) continue;
    target.set(fips, feature);
    added += 1;
  }
  return added;
}

export function countyFeaturesToCollection(
  features: Map<string, GeoJSON.Feature>
): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: [...features.values()],
  };
}

function countyFipsId(feature: GeoJSON.Feature): string | null {
  const fips = String(
    (feature.properties as { fips?: string } | undefined)?.fips ?? feature.id ?? ''
  )
    .trim()
    .padStart(5, '0');
  return fips || null;
}

export function createCountyViewportLoader(options: CountyViewportLoaderOptions = {}) {
  const cellLoader = createCellLayerLoader(options);

  async function loadCountiesForViewport(
    bounds: ViewportBounds,
    target: Map<string, GeoJSON.Feature>,
    loadOptions?: {
      onStateMerged?: (detail: { stateCode: string; featureCount: number }) => void;
    }
  ): Promise<{ requestedStates: number; loadedStates: number; features: number }> {
    const states = await fetchStatesBulkGeoJson({
      baseUrl: options.baseUrl,
      init: options.getRequestInit?.() ?? options.init,
    });
    if (!states?.features?.length) {
      return { requestedStates: 0, loadedStates: 0, features: target.size };
    }

    const centerLat = (bounds.north + bounds.south) / 2;
    const centerLng = (bounds.east + bounds.west) / 2;
    const zoom = 7;

    const result = await cellLoader.loadLayerForViewport({
      viewport: { bounds, centerLat, centerLng, zoom },
      layer: 'county',
      target,
      getFeatureId: countyFipsId,
      onShardMerged: (detail) => {
        loadOptions?.onStateMerged?.({
          stateCode: detail.cellId,
          featureCount: detail.featureCount,
        });
      },
    });

    return {
      requestedStates: result.requestedCells,
      loadedStates: result.loadedCells,
      features: result.features,
    };
  }

  return { loadCountiesForViewport };
}

export function clearCountyViewportCache(_baseUrl?: string): void {
  /* cell bundle cache lives in cell-layers */
}
