import type { Feature, FeatureCollection, GeoJsonProperties } from 'geojson';

/** MapTiler geocode feature — labels are on the root, not always in properties. */
export type MaptilerGeocodeFeature = Feature & {
  text?: string;
  place_name?: string;
  place_name_en?: string;
  text_en?: string;
};

function trimmed(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function copyProperties(properties: GeoJsonProperties): Record<string, unknown> {
  if (properties && typeof properties === 'object' && !Array.isArray(properties)) {
    return { ...(properties as Record<string, unknown>) };
  }
  return {};
}

/** Lift root `text` / `place_name` into `properties` for GeoJSON consumers. */
export function normalizeMaptilerGeocodeFeature(feature: Feature): Feature {
  const root = feature as MaptilerGeocodeFeature;
  const properties = copyProperties(root.properties);

  const name =
    trimmed(properties.name) ??
    trimmed(root.text) ??
    trimmed(root.text_en) ??
    trimmed(root.place_name) ??
    trimmed(root.place_name_en);

  const placeName =
    trimmed(properties.place_name) ??
    trimmed(root.place_name) ??
    trimmed(root.place_name_en) ??
    name;

  if (name) properties.name = name;
  if (placeName) properties.place_name = placeName;

  return { ...root, properties };
}

export function normalizeMaptilerGeocodeCollection(
  data: FeatureCollection,
): FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: (data.features ?? []).map(normalizeMaptilerGeocodeFeature),
  };
}
