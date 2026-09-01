import type { Polygon as GeoJsonPolygon } from 'geojson';

export type LatLon = [number, number];
export type Polygon = GeoJsonPolygon;
export type H3Point = string & { __brand: 'H3Point' };
export type H3Area = string & { __brand: 'H3Area' };
