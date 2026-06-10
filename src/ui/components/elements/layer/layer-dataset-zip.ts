/**
 * ZIP outline preset — `/us/zip/{code}` CDN namespace.
 */

import { fetchZipFeatures } from '../../../../cdn/zip';
import { resolveGlobeCdnBaseUrl } from '../../../../cdn/config';
import type { LayerDatasetContext, LayerDatasetHandle } from './layer-datasets';
import {
  buildPresetAdminOutlineConfig,
  mountAdminOutlineDatasetPreset,
  type AdminOutlineDatasetPresetDef,
} from './layer-dataset-shared';

export const ZIP_DATASET_IDS = {
  polygonSourceId: 'gk-dataset-zip',
  lineSourceId: 'gk-dataset-zip-line-src',
  fillLayerId: 'gk-dataset-zip-fill',
  lineLayerId: 'gk-dataset-zip-line',
} as const;

const ZIP_OUTLINE_PRESET: AdminOutlineDatasetPresetDef = {
  kind: 'zip',
  ids: ZIP_DATASET_IDS,
  style: {
    lineColor: 'rgba(255, 255, 255, 0.18)',
    lineWidth: 0.35,
    minzoom: 10,
  },
};

export async function mountZipDataset(
  ctx: LayerDatasetContext
): Promise<LayerDatasetHandle | null> {
  const zipSlugs = ctx.options.slugs;
  if (!zipSlugs?.length) {
    console.warn('[gk-layer] zip dataset requires slugs (comma-separated ZIP codes)');
    return null;
  }

  const baseUrl = resolveGlobeCdnBaseUrl(ctx.options.cdnBase);
  const config = buildPresetAdminOutlineConfig(ZIP_OUTLINE_PRESET, ctx.options);

  return mountAdminOutlineDatasetPreset(
    ctx,
    ZIP_OUTLINE_PRESET,
    async ({ getRequestInit }) => {
      const zips = await fetchZipFeatures(zipSlugs, {
        baseUrl,
        init: getRequestInit?.() ?? undefined,
      });
      return zips.features.length ? zips : null;
    },
    {
      hitLayerIds: (c) => (c.options.interactive ? [config.fillLayerId] : undefined),
    }
  );
}
