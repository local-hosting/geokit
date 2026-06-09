/**
 * State outline preset for gk-layer — `/us/state/**` CDN namespace.
 */

import { fetchStatesBulkGeoJson } from '../../../../cdn/bulk';
import { resolveGlobeCdnBaseUrl } from '../../../../cdn/config';
import {
  addStateBoundaries,
  applyStateLinePaint,
  removeStateBoundaries,
  type StateBoundaryConfig,
} from '../../../utils/state-boundaries';
import {
  findInsertBeforeLayer,
  stackGkOutlineLayersAboveDmaFill,
} from '../../../utils/layer-stack';
import type {
  LayerDatasetContext,
  LayerDatasetHandle,
  LayerDatasetOptions,
} from './layer-datasets';

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

type MapLike = NonNullable<LayerDatasetContext['map']>;

function findAnchorBeforeId(map: MapLike): string | undefined {
  return findInsertBeforeLayer(map, {
    matchLayer: (layer) => {
      const id = layer.id ?? '';
      return id.startsWith('gk-dataset-') || id.startsWith('venues') || id.startsWith('platform-');
    },
  });
}

function stateConfig(options: LayerDatasetOptions): StateBoundaryConfig {
  return {
    ...STATE_DATASET_IDS,
    lineColor: options.lineColor ?? 'rgba(255, 255, 255, 0.32)',
    lineWidth: options.lineWidth ?? DEFAULT_STATE_LINE_WIDTH,
    lineMinzoom: 2,
  };
}

export async function mountStateDataset(
  ctx: LayerDatasetContext
): Promise<LayerDatasetHandle | null> {
  const { map, options, getRequestInit } = ctx;
  const config = stateConfig(options);
  const baseUrl = resolveGlobeCdnBaseUrl(options.cdnBase);
  const beforeLayerId = options.beforeLayerId ?? findAnchorBeforeId(map);

  const states = await fetchStatesBulkGeoJson({
    baseUrl,
    init: getRequestInit?.() ?? undefined,
  });
  if (!states?.features?.length) return null;

  addStateBoundaries(map, states, config, beforeLayerId);
  applyStateLinePaint(map, config);
  stackGkOutlineLayersAboveDmaFill(map);

  return {
    sourceId: config.polygonSourceId,
    layerId: config.fillLayerId,
    hitLayerIds: [config.fillLayerId],
    cleanup: () => {
      removeStateBoundaries(map, config);
    },
  };
}
