/**
 * Place / city outline preset — `/us/place/{state}/**` CDN namespace.
 */

import {
  fetchStateCitiesGeoJson,
  fetchStatePlaceFeature,
  fetchStatePlacesForViewport,
} from '../../../../cdn/place';
import { resolveGlobeCdnBaseUrl } from '../../../../cdn/config';
import { mapViewportBounds } from '../../../../utils/h3/map-viewport';
import type { LayerDatasetContext, LayerDatasetHandle } from './layer-datasets';
import {
  bindAdminOutlineViewportRefresh,
  buildPresetAdminOutlineConfig,
  mountAdminOutlineDatasetPreset,
  type AdminOutlineDatasetPresetDef,
} from './layer-dataset-shared';

const PLACE_VIEWPORT_SYNC_DEBOUNCE_MS = 400;

export const PLACE_DATASET_IDS = {
  polygonSourceId: 'gk-dataset-place',
  lineSourceId: 'gk-dataset-place-line-src',
  fillLayerId: 'gk-dataset-place-fill',
  lineLayerId: 'gk-dataset-place-line',
} as const;

const PLACE_OUTLINE_PRESET: AdminOutlineDatasetPresetDef = {
  kind: 'place',
  ids: PLACE_DATASET_IDS,
  style: {
    lineColor: 'rgba(147, 197, 253, 0.55)',
    lineWidth: 1,
    minzoom: 7,
  },
};

async function loadPlaceFeatures(
  ctx: LayerDatasetContext
): Promise<GeoJSON.FeatureCollection | null> {
  const { map, options, getRequestInit } = ctx;
  const state = options.state?.trim().toLowerCase();
  if (!state) {
    console.warn('[gk-layer] place dataset requires state attribute');
    return null;
  }

  const mode = options.mode ?? 'viewport';
  const baseUrl = resolveGlobeCdnBaseUrl(options.cdnBase);
  const fetchOptions = { baseUrl, init: getRequestInit?.() ?? undefined };

  if (mode === 'slugs' && options.slugs?.length) {
    const features: GeoJSON.Feature[] = [];
    for (const slug of options.slugs) {
      const feature = await fetchStatePlaceFeature(state, slug, fetchOptions);
      if (feature) features.push(feature);
    }
    return { type: 'FeatureCollection', features };
  }

  if (mode === 'viewport') {
    const viewport = mapViewportBounds(map);
    if (viewport?.bounds) {
      const { west, south, east, north } = viewport.bounds;
      return fetchStatePlacesForViewport(state, west, south, east, north, fetchOptions);
    }
    return null;
  }

  return fetchStateCitiesGeoJson(state, fetchOptions);
}

function placeViewportLoader(
  ctx: LayerDatasetContext
): () => Promise<GeoJSON.FeatureCollection | null> {
  const state = ctx.options.state!.trim().toLowerCase();
  const baseUrl = resolveGlobeCdnBaseUrl(ctx.options.cdnBase);
  const fetchOptions = { baseUrl, init: ctx.getRequestInit?.() ?? undefined };

  return async () => {
    const viewport = mapViewportBounds(ctx.map);
    if (!viewport?.bounds) return null;
    const { west, south, east, north } = viewport.bounds;
    return fetchStatePlacesForViewport(state, west, south, east, north, fetchOptions);
  };
}

export async function mountPlaceDataset(
  ctx: LayerDatasetContext
): Promise<LayerDatasetHandle | null> {
  if (!ctx.options.state?.trim()) {
    console.warn('[gk-layer] place dataset requires state attribute');
    return null;
  }

  const config = buildPresetAdminOutlineConfig(PLACE_OUTLINE_PRESET, ctx.options);
  const mode = ctx.options.mode ?? 'viewport';

  return mountAdminOutlineDatasetPreset(ctx, PLACE_OUTLINE_PRESET, loadPlaceFeatures, {
    hitLayerIds: (c) => (c.options.interactive ? [config.fillLayerId] : undefined),
    afterMount:
      mode === 'viewport'
        ? (mountCtx, mountConfig) =>
            bindAdminOutlineViewportRefresh(
              mountCtx.map,
              placeViewportLoader(mountCtx),
              mountConfig,
              PLACE_VIEWPORT_SYNC_DEBOUNCE_MS
            )
        : undefined,
  });
}
