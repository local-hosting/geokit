/**
 * gk-layer dataset registry — host app registers mounts via registerLayerDatasetMount() at boot.
 */

import { resolveLayerDatasetMount } from '@geokit/core/geojson-loader';
import type {
  LayerDatasetContext,
  LayerDatasetHandle,
  LayerDatasetId,
  LayerDatasetMode,
  LayerDatasetOptions,
  LayerDatasetReadyDetail,
} from '@geokit/core/types/layer-datasets';

export type {
  LayerDatasetContext,
  LayerDatasetHandle,
  LayerDatasetId,
  LayerDatasetMode,
  LayerDatasetOptions,
  LayerDatasetReadyDetail,
};

const DATASET_ATTR_ALIASES: Record<string, string> = {
  place: 'city',
};

export function normalizeLayerDatasetId(
  value: string | null | undefined
): LayerDatasetId | null {
  const trimmed = value?.trim().toLowerCase();
  if (!trimmed) return null;
  return DATASET_ATTR_ALIASES[trimmed] ?? trimmed;
}

/** @deprecated use normalizeLayerDatasetId */
export function resolveLayerDatasetId(value: string | null | undefined): LayerDatasetId | null {
  return normalizeLayerDatasetId(value);
}

/** @deprecated use normalizeLayerDatasetId */
export function isLayerDatasetId(value: string | null | undefined): value is LayerDatasetId {
  return normalizeLayerDatasetId(value) !== null;
}

export function parseLayerDatasetSlugs(raw: string | null | undefined): string[] | undefined {
  if (!raw?.trim()) return undefined;
  const slugs = raw
    .split(',')
    .map((slug) => slug.trim().toLowerCase())
    .filter(Boolean);
  return slugs.length > 0 ? slugs : undefined;
}

export async function mountLayerDataset(
  ctx: LayerDatasetContext
): Promise<LayerDatasetHandle | null> {
  const resolved = normalizeLayerDatasetId(ctx.dataset);
  if (!resolved) return null;
  const mount = resolveLayerDatasetMount(resolved);
  if (!mount) {
    console.warn(
      `[gk-layer] no dataset mount registered for "${resolved}" — call registerLayerDatasetMount() from your app bootstrap`
    );
    return null;
  }
  return mount({ ...ctx, dataset: resolved });
}

export function unmountLayerDataset(handle: LayerDatasetHandle | null | undefined): void {
  handle?.cleanup();
}

export {
  registerLayerDatasetMount,
  unregisterLayerDatasetMount,
  clearLayerDatasetMounts,
} from '@geokit/core/geojson-loader';
