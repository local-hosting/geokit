export function mergeFeaturesById(
  target: Map<string, GeoJSON.Feature>,
  collection: GeoJSON.FeatureCollection,
  getFeatureId: (feature: GeoJSON.Feature) => string | null
): number {
  let added = 0;
  for (const feature of collection.features) {
    const id = getFeatureId(feature);
    if (!id || target.has(id)) continue;
    target.set(id, feature);
    added += 1;
  }
  return added;
}

export function featuresMapToCollection(
  features: Map<string, GeoJSON.Feature>
): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: [...features.values()],
  };
}
