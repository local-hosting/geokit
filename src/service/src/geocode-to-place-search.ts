import type { Feature, FeatureCollection } from 'geojson';
import type { PlaceSearchResult } from './services/types';

function featureToPlaceSearchResult(
  feature: Feature,
  index: number,
): PlaceSearchResult | null {
  if (feature.geometry?.type !== 'Point') return null;
  const coords = feature.geometry.coordinates;
  if (!Array.isArray(coords) || coords.length < 2) return null;
  const lng = Number(coords[0]);
  const lat = Number(coords[1]);
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;

  const props = feature.properties ?? {};
  const name =
    (typeof props.name === 'string' && props.name.trim()) ||
    (typeof props.place_name === 'string' && props.place_name.trim()) ||
    (typeof props.label === 'string' && props.label.trim()) ||
    '';
  if (!name) return null;

  const id =
    (typeof feature.id === 'string' && feature.id) ||
    (typeof props.ref === 'string' && props.ref) ||
    `geocode:${index}:${name}`;

  const address =
    typeof props.place_name === 'string' && props.place_name !== name
      ? props.place_name
      : undefined;

  return { id, name, address, location: [lng, lat] };
}

/** Forward-geocode features → placeSearch-shaped rows (cities, regions, addresses). */
export function geocodeFeaturesToPlaceSearchResults(
  collection: FeatureCollection,
  limit = 8,
): PlaceSearchResult[] {
  const rows: PlaceSearchResult[] = [];
  for (const [index, feature] of (collection.features ?? []).entries()) {
    if (rows.length >= limit) break;
    const row = featureToPlaceSearchResult(feature, index);
    if (row) rows.push(row);
  }
  return rows;
}
