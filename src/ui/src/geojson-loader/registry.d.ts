import type { LayerDatasetContext, LayerDatasetHandle, LayerDatasetId } from '@geokit/core/types/layer-datasets';
export type LayerDatasetMountFn = (ctx: LayerDatasetContext) => Promise<LayerDatasetHandle | null>;
export declare function registerLayerDatasetMount(id: LayerDatasetId, mount: LayerDatasetMountFn): void;
export declare function unregisterLayerDatasetMount(id: LayerDatasetId): void;
export declare function clearLayerDatasetMounts(): void;
export declare function resolveLayerDatasetMount(id: LayerDatasetId): LayerDatasetMountFn | undefined;
//# sourceMappingURL=registry.d.ts.map