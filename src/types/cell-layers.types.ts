/** H3 cell layer bundle schema (H3 cell bundle `/cell/{cellId}.json`). */

export type CellLayerId = string;

export type CellLayerCatalogV1 = {
  version: 1;
  urlPattern: string;
  queryLayers: readonly CellLayerId[];
  layerKeys: readonly CellLayerId[];
  resolutions: readonly number[];
  countyMinZoom?: number;
  count: number;
  cellIds: string[];
};

export type CellLayerBundleV1 = {
  version: 1;
  cellId: string;
  resolution: number;
  layers: Partial<Record<CellLayerId, GeoJSON.FeatureCollection>>;
};
