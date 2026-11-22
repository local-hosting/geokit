

import type { ResolvedMapStaticProvider } from '../types/static-map';
import { DEFAULT_REGION_PATH_STYLE } from './region-path';
import type { MapRegionPathStyle } from './region-path';
import { bufferPoint } from '../utils/buffer/buffer-point';

const MARKER_RADIUS_METERS = 80;

const OVERLAY_PALETTE: MapRegionPathStyle[] = [
  { fill: '%233b82f6cc', stroke: '%231d4ed8', width: 4 },
  { fill: '%2322c55ecc', stroke: '%2315803d', width: 4 },
  { fill: '%23f97316cc', stroke: '%23c2410c', width: 4 },
  { fill: '%23a855f7cc', stroke: '%237e22ce', width: 4 },
];

function bufferAroundPoint(
  lat: number,
  lng: number,
  radiusMeters: number,
  steps: number
): GeoJSON.Polygon {
  return bufferPoint([lat, lng], radiusMeters, steps);
}

function paletteStyle(colorIndex: number, translucent = false): MapRegionPathStyle {
  const base = OVERLAY_PALETTE[colorIndex % OVERLAY_PALETTE.length];
  if (!translucent) {
    return base;
  }
  return { ...base, fill: base.fill.replace('cc', '55') };
}

function geometryToProviderOverlays(
  provider: ResolvedMapStaticProvider,
  geometry: GeoJSON.Geometry,
  style?: Partial<MapRegionPathStyle>
): string[] {
  return provider.adapter.geometryToOverlays(geometry, { style });
}

export function markerGeometry(lat: number, lng: number): GeoJSON.Polygon {
  return bufferAroundPoint(lat, lng, MARKER_RADIUS_METERS, 12);
}

export function circleGeometry(lat: number, lng: number, radiusMeters: number): GeoJSON.Polygon {
  return bufferAroundPoint(lat, lng, radiusMeters, 48);
}

export function markerOverlay(
  provider: ResolvedMapStaticProvider,
  lat: number,
  lng: number,
  colorIndex = 0
): string[] {
  return geometryToProviderOverlays(provider, markerGeometry(lat, lng), paletteStyle(colorIndex));
}

export function circleOverlay(
  provider: ResolvedMapStaticProvider,
  lat: number,
  lng: number,
  radiusMeters: number,
  colorIndex = 0
): string[] {
  return geometryToProviderOverlays(
    provider,
    circleGeometry(lat, lng, radiusMeters),
    paletteStyle(colorIndex, true)
  );
}

export function polygonOverlay(
  provider: ResolvedMapStaticProvider,
  geometry: GeoJSON.Geometry,
  colorIndex = 0,
  styleOverride?: Partial<MapRegionPathStyle>
): string[] {
  const style =
    styleOverride ?? (colorIndex === 0 ? DEFAULT_REGION_PATH_STYLE : paletteStyle(colorIndex, true));
  return geometryToProviderOverlays(provider, geometry, style);
}
