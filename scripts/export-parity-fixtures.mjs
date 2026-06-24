#!/usr/bin/env node
import { latLngToCell } from 'h3-js';
import { calculateCenterAndZoom } from '../dist/esm/utils/bounds/calculate-zoom.js';
import { haversineMeters } from '../dist/esm/utils/distance/haversine.js';
import { bearing } from '../dist/esm/utils/bearing/initial.js';
import { isValidCoordinate } from '../dist/esm/utils/coordinates/validation.js';
import { getBounds, getCenter } from '../dist/esm/utils/bounds/index.js';

const nyc = { latitude: 40.7128, longitude: -74.006 };
const la = { latitude: 34.0522, longitude: -118.2437 };
const nearNyc = { latitude: 40.713, longitude: -74.0062 };
const nycPairPoints = [[40.7128, -74.006], [40.758, -73.9855]];
const centerBounds = [-74.006, 40.7128, -73.9855, 40.758];
const centerAndZoomBounds = [-74.1, 40.6, -73.9, 40.8];
const center = getCenter(centerBounds);
const centerAndZoom = calculateCenterAndZoom(centerAndZoomBounds);
const nycLatLon = [nyc.latitude, nyc.longitude];
const laLatLon = [la.latitude, la.longitude];

const fixtures = {
  version: 1,
  description: 'Shared parity fixtures — generated from @twinfile/geokit',
  coordinates: { nyc, la, nearNyc },
  bounds: {
    nycPair: {
      points: nycPairPoints.map(([latitude, longitude]) => ({ latitude, longitude })),
      expected: getBounds(nycPairPoints),
    },
    centerFromBounds: {
      bounds: centerBounds,
      center: { latitude: center[0], longitude: center[1] },
    },
    centerAndZoom: {
      bounds: centerAndZoomBounds,
      expected: {
        latitude: centerAndZoom.lat,
        longitude: centerAndZoom.lng,
        zoom: centerAndZoom.zoom,
      },
    },
  },
  distance: {
    nycToLaMeters: { from: 'nyc', to: 'la', minMeters: 3900000, maxMeters: 4000000 },
    samePointMeters: { from: 'nyc', to: 'nyc', expectedMeters: 0 },
    nearbyWithin1km: { from: 'nyc', to: 'nearNyc', thresholdMeters: 1000, expectedWithin: true },
  },
  bearing: {
    east: {
      from: { latitude: 0, longitude: 0 },
      to: { latitude: 0, longitude: 1 },
      expectedDegrees: (bearing([0, 0])([0, 1]) + 360) % 360,
      toleranceDegrees: 1,
    },
    north: {
      from: { latitude: 0, longitude: 0 },
      to: { latitude: 1, longitude: 0 },
      expectedDegrees: (bearing([0, 0])([1, 0]) + 360) % 360,
      toleranceDegrees: 1,
    },
  },
  h3: {
    nycRes9: {
      latitude: nyc.latitude,
      longitude: nyc.longitude,
      resolution: 9,
      expectedCell: latLngToCell(nyc.latitude, nyc.longitude, 9),
    },
  },
  validation: {
    valid: {
      latitude: nyc.latitude,
      longitude: nyc.longitude,
      expected: isValidCoordinate([nyc.latitude, nyc.longitude]),
    },
    invalidLatitude: {
      latitude: 91,
      longitude: -74.006,
      expected: isValidCoordinate([91, -74.006]),
    },
  },
};

process.stdout.write(JSON.stringify(fixtures, null, 2) + '\n');
