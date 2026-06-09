/**
 * TopoJSON conversion utilities
 *
 * Typed wrappers around topojson-client for converting TopoJSON to GeoJSON.
 * Follows the same pattern as other geokit utilities — thin, typed, functional.
 */

import type * as GeoJSON from 'geojson';
import type {
  Topology,
  GeometryObject,
  GeometryCollection,
  Polygon,
  MultiPolygon,
  Properties,
} from 'topojson-specification';
import { feature, merge, mesh, neighbors } from 'topojson-client';
import { topology as buildTopology } from 'topojson-server';
import { presimplify, simplify as simplifyTopo, planarTriangleArea } from 'topojson-simplify';

// Re-export key types for consumers
export type {
  Topology,
  GeometryObject,
  GeometryCollection,
  Properties,
} from 'topojson-specification';

/**
 * Convert a named TopoJSON object to a GeoJSON FeatureCollection.
 *
 * @param topology - A parsed TopoJSON Topology
 * @param objectName - Key of the object in `topology.objects` (e.g. "counties", "states")
 * @returns GeoJSON FeatureCollection, or null if the object doesn't exist
 *
 * @example
 * ```ts
 * const fc = topoFeature(usAtlas, 'counties');
 * // fc.features[0].properties.name => "San Benito"
 * ```
 */
type TopoPolygonObject = Polygon | MultiPolygon;

/**
 * Build a TopoJSON topology from named GeoJSON objects.
 * Pass `quantization: false` to keep rounded lng/lat without delta encoding.
 */
export function geojsonToTopology(
  objects: Record<string, GeoJSON.GeoJSON>,
  options: { quantization?: number | false } = {}
): Topology {
  const quantization = options.quantization ?? false;
  return buildTopology(objects, quantization);
}

const PLANAR_MIN_WEIGHT_SCALE = 15;

function metersPerDegreeLatitude(latDeg: number): number {
  return 111320 * Math.cos((latDeg * Math.PI) / 180);
}

/** Planar triangle minWeight for topojson-simplify given a meter tolerance. */
function minPlanarWeightFromToleranceMeters(toleranceMeters: number, avgLatDeg = 40): number {
  const toleranceDeg = toleranceMeters / metersPerDegreeLatitude(avgLatDeg);
  return ((toleranceDeg * toleranceDeg) / 2) * PLANAR_MIN_WEIGHT_SCALE;
}

/**
 * Simplify a TopoJSON topology once — shared arcs stay aligned across features.
 * Uses planar triangle weights (input coordinates in WGS84 degrees).
 */
export function simplifyTopologyMeters(topology: Topology, toleranceMeters: number): Topology {
  if (toleranceMeters <= 0) return topology;
  const minWeight = minPlanarWeightFromToleranceMeters(toleranceMeters);
  const prepared = presimplify(topology, planarTriangleArea);
  return simplifyTopo(prepared, minWeight);
}

type TopoPolygonFeatureCollection<P extends GeoJSON.GeoJsonProperties> = GeoJSON.FeatureCollection<
  GeoJSON.Polygon | GeoJSON.MultiPolygon,
  P
>;

/**
 * Build topology from a polygon FeatureCollection, simplify arcs once, convert back.
 * Feature order and properties are preserved by index.
 */
export function simplifyFeatureCollectionTopology<P extends GeoJSON.GeoJsonProperties>(
  collection: TopoPolygonFeatureCollection<P>,
  objectName: string,
  toleranceMeters: number
): TopoPolygonFeatureCollection<P> {
  if (toleranceMeters <= 0 || collection.features.length === 0) {
    return collection;
  }

  const originalFeatures = collection.features;
  const topology = geojsonToTopology({ [objectName]: collection });
  const simplifiedTopology = simplifyTopologyMeters(topology, toleranceMeters);
  const simplified = topoFeature(simplifiedTopology, objectName);
  if (!simplified?.features.length) return collection;

  const features = simplified.features.map((simplifiedFeature, index) => ({
    ...simplifiedFeature,
    properties: originalFeatures[index]?.properties ?? simplifiedFeature.properties,
  })) as TopoPolygonFeatureCollection<P>['features'];

  return { type: 'FeatureCollection', features };
}

/**
 * Map feature property values to TopoJSON geometry objects inside a named layer.
 * Feature order must match the FeatureCollection passed to {@link geojsonToTopology}.
 */
export function topoGeometriesByProperty<P extends GeoJSON.GeoJsonProperties>(
  topology: Topology,
  objectName: string,
  features: GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon, P>[],
  propertyKey: keyof P & string
): Map<string, TopoPolygonObject> {
  const obj = topology.objects[objectName];
  if (!obj || obj.type !== 'GeometryCollection') {
    throw new Error(`topoGeometriesByProperty: expected GeometryCollection "${objectName}"`);
  }

  const geometries = (obj as GeometryCollection).geometries;
  const map = new Map<string, TopoPolygonObject>();

  for (let i = 0; i < features.length; i++) {
    const value = features[i].properties?.[propertyKey];
    const geometry = geometries[i];
    if (typeof value === 'string' && geometry) {
      map.set(value, geometry as TopoPolygonObject);
    }
  }

  return map;
}

/**
 * Convert a named TopoJSON object to a GeoJSON FeatureCollection.
 *
 * @param topology - A parsed TopoJSON Topology
 * @param objectName - Key of the object in `topology.objects` (e.g. "counties", "states")
 * @returns GeoJSON FeatureCollection, or null if the object doesn't exist
 *
 * @example
 * ```ts
 * const fc = topoFeature(usAtlas, 'counties');
 * // fc.features[0].properties.name => "San Benito"
 * ```
 */
export function topoFeature<P extends Properties = GeoJSON.GeoJsonProperties>(
  topology: Topology,
  objectName: string
): GeoJSON.FeatureCollection<GeoJSON.GeometryObject, P> | null {
  const obj = topology.objects[objectName];
  if (!obj) return null;

  const result = feature(topology, obj as GeometryCollection<P>);

  // feature() returns Feature for simple geometries, FeatureCollection for GeometryCollection
  if (result.type === 'FeatureCollection') {
    return result as unknown as GeoJSON.FeatureCollection<GeoJSON.GeometryObject, P>;
  }

  // Wrap single Feature in a FeatureCollection for a consistent return type
  const feat = result as unknown as GeoJSON.Feature<GeoJSON.GeometryObject, P>;
  return {
    type: 'FeatureCollection' as const,
    features: [feat],
  };
}

/**
 * Merge (dissolve) multiple TopoJSON polygon objects into a single GeoJSON MultiPolygon.
 * Useful for combining counties into a DMA or states into a nation.
 *
 * @param topology - A parsed TopoJSON Topology
 * @param objects - Array of TopoJSON Polygon/MultiPolygon geometry objects to merge
 * @returns A single GeoJSON MultiPolygon geometry
 *
 * @example
 * ```ts
 * const countyObjects = getCountyObjectsByDMA(topology, 'dallas-fort-worth');
 * const dmaShape = topoMerge(topology, countyObjects);
 * ```
 */
export function topoMerge(
  topology: Topology,
  objects: Array<Polygon | MultiPolygon>
): GeoJSON.MultiPolygon {
  return merge(topology, objects);
}

/**
 * Extract boundary lines from a TopoJSON object as a GeoJSON MultiLineString.
 * With a filter, can extract only interior or exterior boundaries.
 *
 * @param topology - A parsed TopoJSON Topology
 * @param objectName - Key of the object in `topology.objects`
 * @param filter - Optional filter: `(a, b) => boolean`. Called for each arc shared by
 *   geometries a and b. Return true to include the arc. Use `(a, b) => a !== b` for
 *   interior boundaries only, or `(a, b) => a === b` for exterior boundaries only.
 * @returns GeoJSON MultiLineString of the boundary lines, or null if object doesn't exist
 *
 * @example
 * ```ts
 * // All county boundaries
 * const allBorders = topoMesh(topology, 'counties');
 *
 * // Only borders between different counties (interior)
 * const interiorBorders = topoMesh(topology, 'counties', (a, b) => a !== b);
 * ```
 */
export function topoMesh(
  topology: Topology,
  objectName: string,
  filter?: (a: GeometryObject, b: GeometryObject) => boolean
): GeoJSON.MultiLineString | null {
  const obj = topology.objects[objectName];
  if (!obj) return null;
  return mesh(topology, obj as GeometryObject<Record<string, never>>, filter);
}

/**
 * Find neighbor relationships for geometries in a TopoJSON object.
 * Returns an array where `result[i]` contains the indices of geometries
 * that share an arc with geometry `i`.
 *
 * @param topology - A parsed TopoJSON Topology
 * @param objectName - Key of the object in `topology.objects`
 * @returns Array of neighbor index arrays, or null if object doesn't exist
 *
 * @example
 * ```ts
 * const adj = topoNeighbors(topology, 'counties');
 * // adj[0] => [3, 7, 12] — county 0 borders counties 3, 7, 12
 * ```
 */
export function topoNeighbors(topology: Topology, objectName: string): number[][] | null {
  const obj = topology.objects[objectName];
  if (!obj || obj.type !== 'GeometryCollection') return null;
  return neighbors((obj as GeometryCollection).geometries);
}

/**
 * List the object names available in a TopoJSON Topology.
 *
 * @param topology - A parsed TopoJSON Topology
 * @returns Array of object name strings
 *
 * @example
 * ```ts
 * topoObjectNames(usAtlas); // => ['counties', 'states', 'nation']
 * ```
 */
export function topoObjectNames(topology: Topology): string[] {
  return Object.keys(topology.objects);
}
