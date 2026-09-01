/**
 * Optional US county boundary geometries for point → DMA resolution.
 */

export type CountyBoundaryFeature = GeoJSON.Feature<
  GeoJSON.Polygon | GeoJSON.MultiPolygon,
  { fips?: string; dmaSlug?: string }
>;

let countyFeatures: readonly CountyBoundaryFeature[] | null = null;

export function registerCountyBoundaries(
  collection: GeoJSON.FeatureCollection
): void {
  countyFeatures = collection.features.filter(
    (feature): feature is CountyBoundaryFeature =>
      Boolean(feature.geometry) &&
      (feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon')
  );
}

export function clearCountyBoundaries(): void {
  countyFeatures = null;
}

export function isCountyBoundariesLoaded(): boolean {
  return countyFeatures !== null && countyFeatures.length > 0;
}

export function getCountyBoundaryFeatures(): readonly CountyBoundaryFeature[] {
  return countyFeatures ?? [];
}
