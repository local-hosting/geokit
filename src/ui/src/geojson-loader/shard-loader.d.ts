import type { ViewportBounds } from '@geokit/h3/lite';
export type ViewportH3LoadOptions = {
    bounds: ViewportBounds;
    centerLat: number;
    centerLng: number;
    resolution: number;
    /** Cap shard requests — keeps center cells when tessellation is large. */
    maxCells?: number;
    /** Include k-ring neighbors around viewport cells (default 0). */
    neighborDiskK?: number;
    /** Expand bounds by this fraction on each axis before tessellation. */
    boundsPaddingFraction?: number;
};
export declare function h3CellIdsForViewportLoad(options: ViewportH3LoadOptions): string[];
/** Normalize catalog cell id — strip trailing f padding from h3-js indices. */
export declare function normalizeLoadedCellId(cellId: string): string;
export declare function loadFeatureCollectionShardsForH3Cells<TId extends string>(options: {
    cellIds: readonly string[];
    target: Map<TId, GeoJSON.Feature>;
    fetchShard: (cellId: string) => Promise<GeoJSON.FeatureCollection | null>;
    getFeatureId: (feature: GeoJSON.Feature) => TId | null;
    onShardMerged?: (detail: {
        cellId: string;
        featureCount: number;
    }) => void;
    replace?: boolean;
    /** When set with replace:false, skip cells already present in this set. */
    loadedCellIds?: Set<string>;
}): Promise<{
    requestedCells: number;
    loadedCells: number;
    features: number;
}>;
//# sourceMappingURL=shard-loader.d.ts.map