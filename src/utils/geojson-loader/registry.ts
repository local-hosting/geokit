import type {
  LayerDatasetContext,
  LayerDatasetHandle,
  LayerDatasetId,
} from '../../ui/components/elements/layer/layer-datasets.js';

export type LayerDatasetMountFn = (
  ctx: LayerDatasetContext
) => Promise<LayerDatasetHandle | null>;

const datasetMounts = new Map<LayerDatasetId, LayerDatasetMountFn>();

export function registerLayerDatasetMount(id: LayerDatasetId, mount: LayerDatasetMountFn): void {
  datasetMounts.set(id, mount);
}

export function unregisterLayerDatasetMount(id: LayerDatasetId): void {
  datasetMounts.delete(id);
}

export function clearLayerDatasetMounts(): void {
  datasetMounts.clear();
}

export function resolveLayerDatasetMount(id: LayerDatasetId): LayerDatasetMountFn | undefined {
  return datasetMounts.get(id);
}
