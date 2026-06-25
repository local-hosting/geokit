#!/usr/bin/env node
import { latLngToCell, cellToParent, cellToChildren, gridDisk, areNeighborCells, getHexagonEdgeLengthAvg, getHexagonAreaAvg } from 'h3-js';
import { calculateCenterAndZoom } from '../dist/esm/utils/bounds/calculate-zoom.js';
import { bearing } from '../dist/esm/utils/bearing/initial.js';
import { midpoint, destinationMeters } from '../dist/esm/utils/bearing/index.js';
import { isValidCoordinate } from '../dist/esm/utils/coordinates/validation.js';
import { getBounds, getCenter } from '../dist/esm/utils/bounds/index.js';
import { encodeGeohash, decodeGeohash, geohashBounds, geohashNeighbors, geohashNeighborsArray, geohashNeighbor, validateGeohash } from '../dist/esm/utils/geohash/index.js';
import { getFeatureId, validateGeoJSON, repairGeometry } from '../dist/esm/utils/geojson/index.js';

const nyc = { latitude: 40.7128, longitude: -74.006 };
const la = { latitude: 34.0522, longitude: -118.2437 };
const nearNyc = { latitude: 40.713, longitude: -74.0062 };
const nycPairPoints = [[40.7128, -74.006], [40.758, -73.9855]];
const centerBounds = [-74.006, 40.7128, -73.9855, 40.758];
const centerAndZoomBounds = [-74.1, 40.6, -73.9, 40.8];
const center = getCenter(centerBounds);
const centerAndZoom = calculateCenterAndZoom(centerAndZoomBounds);
const nycCellRes9 = latLngToCell(nyc.latitude, nyc.longitude, 9);
const nycNeighborsK1 = gridDisk(nycCellRes9, 1);
const ringNeighbor = nycNeighborsK1.find((cell) => cell !== nycCellRes9);
const midpointNycLa = midpoint([nyc.latitude, nyc.longitude])([la.latitude, la.longitude]);
const destination1kmEast = destinationMeters(1000, 90)([nyc.latitude, nyc.longitude]);

const fixtures = {
  version: 3,
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
    midpointNycLa: {
      from: 'nyc',
      to: 'la',
      expected: { latitude: midpointNycLa[0], longitude: midpointNycLa[1] },
      toleranceDegrees: 0.0001,
    },
    destination1kmEast: {
      from: 'nyc',
      distanceMeters: 1000,
      bearingDegrees: 90,
      expected: { latitude: destination1kmEast[0], longitude: destination1kmEast[1] },
      toleranceDegrees: 0.0001,
    },
  },
  h3: {
    nycRes9: {
      latitude: nyc.latitude,
      longitude: nyc.longitude,
      resolution: 9,
      expectedCell: nycCellRes9,
    },
    parentRes8: {
      cell: nycCellRes9,
      resolution: 8,
      expectedParent: cellToParent(nycCellRes9, 8),
    },
    childrenRes10: {
      cell: nycCellRes9,
      resolution: 10,
      expectedChildCount: cellToChildren(nycCellRes9, 10).length,
    },
    neighborsK1: {
      cell: nycCellRes9,
      k: 1,
      expectedCount: nycNeighborsK1.length,
      containsCenter: nycNeighborsK1.includes(nycCellRes9),
      ringNeighborAreNeighbors: ringNeighbor ? areNeighborCells(nycCellRes9, ringNeighbor) : true,
    },
    metricsRes9: {
      resolution: 9,
      expectedEdgeLengthMeters: getHexagonEdgeLengthAvg(9, 'm'),
      expectedCellAreaM2: getHexagonAreaAvg(9, 'm2'),
      edgeLengthToleranceMeters: 0.001,
      cellAreaToleranceM2: 0.001,
    },
  },

  geohash: {
    encodeNycRes9: {
      from: 'nyc',
      precision: 9,
      expectedHash: encodeGeohash(9)([nyc.latitude, nyc.longitude]),
    },
    decodeRes9: {
      hash: encodeGeohash(9)([nyc.latitude, nyc.longitude]),
      expected: {
        latitude: decodeGeohash(encodeGeohash(9)([nyc.latitude, nyc.longitude]))[0],
        longitude: decodeGeohash(encodeGeohash(9)([nyc.latitude, nyc.longitude]))[1],
      },
      tolerance: 0.0001,
    },
    boundsRes5: {
      hash: 'dr5r',
      expected: geohashBounds('dr5r'),
    },
    neighborsRes5: {
      hash: 'dr5r',
      expected: geohashNeighbors('dr5r'),
      expectedArray: geohashNeighborsArray('dr5r'),
    },
    validation: {
      validHash: 'dr5r',
      invalidHash: 'invalid!',
      validExpected: validateGeohash('dr5r'),
      invalidExpected: validateGeohash('invalid!'),
    },
  },
  geojson: {
    pointCoordinates: [-74.006, 40.7128],
    expectedFeatureId: '123',
    openRingCoordinates: [[-74, 40], [-73, 40], [-73, 41], [-74, 41]],
    expectedClosedRingCount: repairGeometry({
      type: 'Polygon',
      coordinates: [[[-74, 40], [-73, 40], [-73, 41], [-74, 41]]],
    }).coordinates[0].length,
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
