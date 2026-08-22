import { boundaryOutlinePreset, refreshBoundaryOutlineForPreset, type BoundaryOutlinePresetKind } from './boundary-outline-preset.js';
import type { OutlineLayerOps } from '../components/elements/layer/layer-dataset-shared.js';

export function createOutlineOps(kind: BoundaryOutlinePresetKind): OutlineLayerOps {
  const preset = boundaryOutlinePreset(kind);
  return {
    add: preset.add as OutlineLayerOps['add'],
    applyPaint: preset.applyPaint as OutlineLayerOps['applyPaint'],
    remove: preset.remove,
    refresh: (map, features, config) => refreshBoundaryOutlineForPreset(map, features, config),
  };
}
