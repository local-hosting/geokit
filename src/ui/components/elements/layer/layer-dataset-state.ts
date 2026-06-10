/**
 * State outline preset for gk-layer — `/us/state/**` CDN namespace.
 */

import { fetchStatesBulkGeoJson } from '../../../../cdn/bulk';
import { resolveGlobeCdnBaseUrl } from '../../../../cdn/config';
import type { LayerDatasetContext, LayerDatasetHandle } from './layer-datasets';
import {
  mountAdminOutlineDatasetPreset,
  type AdminOutlineDatasetPresetDef,
} from './layer-dataset-shared';

const DEFAULT_STATE_LINE_WIDTH: unknown[] = [
  'interpolate',
  ['linear'],
  ['zoom'],
  3,
  0.75,
  6,
  0.9,
  9,
  1.1,
];

export const STATE_DATASET_IDS = {
  polygonSourceId: 'gk-dataset-state',
  lineSourceId: 'gk-dataset-state-line-src',
  fillLayerId: 'gk-dataset-state-fill',
  lineLayerId: 'gk-dataset-state-line',
} as const;

const STATE_OUTLINE_PRESET: AdminOutlineDatasetPresetDef = {
  kind: 'state',
  ids: STATE_DATASET_IDS,
  style: {
    lineColor: 'rgba(255, 255, 255, 0.32)',
    lineWidth: DEFAULT_STATE_LINE_WIDTH,
    lineMinzoom: 2,
  },
};

export async function mountStateDataset(
  ctx: LayerDatasetContext
): Promise<LayerDatasetHandle | null> {
  const baseUrl = resolveGlobeCdnBaseUrl(ctx.options.cdnBase);

  return mountAdminOutlineDatasetPreset(
    ctx,
    STATE_OUTLINE_PRESET,
    async ({ getRequestInit }) => {
      const states = await fetchStatesBulkGeoJson({
        baseUrl,
        init: getRequestInit?.() ?? undefined,
      });
      return states?.features?.length ? states : null;
    },
    {
      hitLayerIds: [STATE_DATASET_IDS.fillLayerId],
    }
  );
}
