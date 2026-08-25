import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { lineString as turfLineString, polygon as turfPolygon } from '@turf/helpers';
import type { Feature, MultiPolygon, Polygon as GeoJsonPolygon } from 'geojson';
import type { LatLon, Polygon } from '../../types';
import { DEFAULT_BUFFER_STEPS, METERS_TO_KILOMETERS } from '../../constants';
import { toLonLatArray } from '../coordinates/conversion';
import { resolveTurfDefault } from '../turf-default-import';
import { bufferPoint } from './buffer-point';

type TurfBufferFn = (
  geojson: GeoJSON.GeoJSON,
  radius: number,
  options?: { units?: string; steps?: number },
) => Feature<GeoJsonPolygon | MultiPolygon>;

let turfBufferCache: TurfBufferFn | undefined;

function getTurfBuffer(): TurfBufferFn {
  if (turfBufferCache) return turfBufferCache;

  const anchor =
    typeof import.meta !== 'undefined' && import.meta.url
      ? import.meta.url
      : pathToFileURL(path.join(process.cwd(), 'package.json')).href;

  const require = createRequire(anchor);
  turfBufferCache = resolveTurfDefault<TurfBufferFn>(require('@turf/buffer'));
  return turfBufferCache;
}

export function bufferLine(
  coordinates: LatLon[],
  radius: number,
  steps: number = DEFAULT_BUFFER_STEPS,
): Polygon {
  if (coordinates.length < 2) {
    throw new Error('Line must have at least 2 coordinates');
  }

  const coords = toLonLatArray(coordinates);
  const line = turfLineString(coords);
  const buffered = getTurfBuffer()(line, radius / METERS_TO_KILOMETERS, { units: 'kilometers', steps });

  if (!buffered || buffered.geometry.type !== 'Polygon') {
    throw new Error('Failed to create buffer');
  }

  return buffered.geometry;
}

export function bufferPolygon(
  polygon: Polygon,
  radius: number,
  steps: number = DEFAULT_BUFFER_STEPS,
): Polygon {
  const poly = turfPolygon(polygon.coordinates);
  const buffered = getTurfBuffer()(poly, radius / METERS_TO_KILOMETERS, { units: 'kilometers', steps });

  if (!buffered || buffered.geometry.type !== 'Polygon') {
    throw new Error('Failed to create buffer');
  }

  return buffered.geometry;
}

export function buffer(
  radius: number,
  steps: number = DEFAULT_BUFFER_STEPS,
): (input: LatLon | LatLon[] | Polygon) => Polygon {
  return (input: LatLon | LatLon[] | Polygon): Polygon => {
    if (typeof input === 'object' && 'type' in input && input.type === 'Polygon') {
      return bufferPolygon(input, radius, steps);
    }

    if (Array.isArray(input) && input.length > 0 && Array.isArray(input[0])) {
      return bufferLine(input as LatLon[], radius, steps);
    }

    return bufferPoint(input as LatLon, radius, steps);
  };
}
