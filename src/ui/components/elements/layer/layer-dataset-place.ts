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
import {
  addAdminOutlineLayer,
  applyAdminOutlineLinePaint,
  refreshAdminOutlineData,
  removeAdminOutlineLayer,
} from '../../../utils/admin-outline-layer';
import {
  findInsertBeforeLayer,
  stackGkOutlineLayersAboveDmaFill,
} from '../../../utils/layer-stack';
import type {
  LayerDatasetContext,
  LayerDatasetHandle,
  LayerDatasetOptions,
} from './layer-datasets';

const PLACE_MIN_ZOOM = 7;
const VIEWPORT_SYNC_DEBOUNCE_MS = 400;

export const PLACE_DATASET_IDS = {
  polygonSourceId: 'gk-dataset-place',
  lineSourceId: 'gk-dataset-place-line-src',
  fillLayerId: 'gk-dataset-place-fill',
  lineLayerId: 'gk-dataset-place-line',
} as const;

type MapLike = NonNullable<LayerDatasetContext['map']>;

function findAnchorBeforeId(map: MapLike): string | undefined {
  return findInsertBeforeLayer(map, {
    matchLayer: (layer) => {
      const id = layer.id ?? '';
      return id.startsWith('gk-dataset-') || id.startsWith('venues') || id.startsWith('platform-');
    },
  });
}

function placeConfig(options: LayerDatasetOptions) {
  const minzoom = options.minzoom ?? PLACE_MIN_ZOOM;
  return {
    ...PLACE_DATASET_IDS,
    lineColor: options.lineColor ?? 'rgba(147, 197, 253, 0.55)',
    lineWidth: options.lineWidth ?? 1,
    minzoom,
    lineMinzoom: minzoom,
  };
}

export async function mountPlaceDataset(
  ctx: LayerDatasetContext
): Promise<LayerDatasetHandle | null> {
  const { map, options, getRequestInit } = ctx;
  const state = options.state?.trim().toLowerCase();
  if (!state) {
    console.warn('[gk-layer] place dataset requires state attribute');
    return null;
  }

  const config = placeConfig(options);
  const mode = options.mode ?? 'viewport';
  const baseUrl = resolveGlobeCdnBaseUrl(options.cdnBase);
  const fetchOptions = { baseUrl, init: getRequestInit?.() ?? undefined };
  const beforeLayerId = options.beforeLayerId ?? findAnchorBeforeId(map);

  let places: GeoJSON.FeatureCollection | null = null;

  if (mode === 'slugs' && options.slugs?.length) {
    const features: GeoJSON.Feature[] = [];
    for (const slug of options.slugs) {
      const feature = await fetchStatePlaceFeature(state, slug, fetchOptions);
      if (feature) features.push(feature);
    }
    places = { type: 'FeatureCollection', features };
  } else if (mode === 'viewport') {
    const viewport = mapViewportBounds(map);
    if (viewport?.bounds) {
      const { west, south, east, north } = viewport.bounds;
      places = await fetchStatePlacesForViewport(state, west, south, east, north, fetchOptions);
    }
  } else {
    places = await fetchStateCitiesGeoJson(state, fetchOptions);
  }

  if (!places?.features?.length) return null;

  addAdminOutlineLayer(map, places, config, beforeLayerId);
  applyAdminOutlineLinePaint(map, config);
  stackGkOutlineLayersAboveDmaFill(map);

  let viewportSyncTimer: ReturnType<typeof setTimeout> | null = null;
  let cleanupViewport: (() => void) | null = null;

  if (mode === 'viewport') {
    const schedule = () => {
      if (viewportSyncTimer) clearTimeout(viewportSyncTimer);
      viewportSyncTimer = setTimeout(() => {
        viewportSyncTimer = null;
        void (async () => {
          const viewport = mapViewportBounds(map);
          if (!viewport?.bounds) return;
          const { west, south, east, north } = viewport.bounds;
          const next = await fetchStatePlacesForViewport(
            state,
            west,
            south,
            east,
            north,
            fetchOptions
          );
          if (!next.features.length) return;
          refreshAdminOutlineData(map, next, config);
        })();
      }, VIEWPORT_SYNC_DEBOUNCE_MS);
    };

    map.on?.('moveend', schedule);
    cleanupViewport = () => {
      if (viewportSyncTimer) clearTimeout(viewportSyncTimer);
      map.off?.('moveend', schedule);
    };
  }

  return {
    sourceId: config.polygonSourceId,
    layerId: config.fillLayerId,
    hitLayerIds: options.interactive ? [config.fillLayerId] : undefined,
    cleanup: () => {
      cleanupViewport?.();
      removeAdminOutlineLayer(map, config);
    },
  };
}
