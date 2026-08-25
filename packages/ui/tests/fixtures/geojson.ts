import { NYC } from './locations';

/** Unit square polygon around the origin — useful for generic geometry assertions. */
export function unitSquarePolygon(): GeoJSON.Polygon {
  return {
    type: 'Polygon',
    coordinates: [
      [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
        [0, 0],
      ],
    ],
  };
}

/** Small polygon around a lat/lng point for isochrone-style responses. */
export function polygonAroundPoint(lat: number, lng: number, delta = 0.01): GeoJSON.Polygon {
  return {
    type: 'Polygon',
    coordinates: [
      [
        [lng, lat],
        [lng + delta, lat],
        [lng + delta, lat + delta],
        [lng, lat + delta],
        [lng, lat],
      ],
    ],
  };
}

/** Standard isochrone FeatureCollection fixture (Mapbox-style contour property). */
export function isochroneFeatureCollection(
  options: { lat?: number; lng?: number; contour?: number } = {}
): GeoJSON.FeatureCollection {
  const lat = options.lat ?? NYC.lat;
  const lng = options.lng ?? NYC.lng;
  const contour = options.contour ?? 15;

  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: polygonAroundPoint(lat, lng),
        properties: { contour },
      },
    ],
  };
}

/** California state feature stub for boundary shape tests. */
export function californiaStateFeature(): GeoJSON.Feature {
  return {
    type: 'Feature',
    properties: { stateCode: 'ca', name: 'California' },
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [0, 0],
          [1, 0],
          [1, 1],
          [0, 0],
        ],
      ],
    },
  };
}
