# @geokit/core

A functional, curried geospatial utility toolkit for browser and Node.js.

## Features

- **Geospatial utilities** - Distance calculations, coordinate conversions, GeoJSON operations, geohashing, H3 indexing
- **Geometry operations** - Centroid calculation, convex hull, line intersection, buffering
- **Measurements** - Line length, polygon perimeter, area calculations
- **Functional programming** - Curried functions for composition and partial application
- **Universal** - Works in both browser and Node.js environments
- **Tree-shakeable** - Import only what you need
- **Well-tested** - Comprehensive test coverage with Vitest
- **Type-safe** - Full TypeScript support

## Installation

```bash
npm install @geokit/core
# or
yarn add @geokit/core
```

## Usage

### Distance Calculations

```typescript
import { haversineMeters, haversineKm, haversineMiles, withinDistance } from '@geokit/core';

// Calculate distance between two points
const nyc = [40.7128, -74.006];
const la = [34.0522, -118.2437];

// Using curried function
const distanceFromNYC = haversineMeters(nyc);
const distance = distanceFromNYC(la); // ~3,944,000 meters

// Or use directly
const dist = haversineMeters(nyc)(la);

// Check if points are within a threshold
const checkWithinDistance = withinDistance(1000, haversineMeters); // 1000 meters
const isClose = checkWithinDistance(nyc)([40.713, -74.0062]); // true
```

### Coordinate Conversions

```typescript
import {
  toLatLon,
  toLonLat,
  isValidCoordinate,
  extractCoordinates,
  createPoint,
} from '@geokit/core';

// Convert between formats
const geojsonCoords = toLonLat([40.7128, -74.006]); // [-74.0060, 40.7128]
const latLonCoords = toLatLon([-74.006, 40.7128]); // [40.7128, -74.0060]

// Validate coordinates
isValidCoordinate([40.7128, -74.006]); // true
isValidCoordinate([91, -74.006]); // false

// Extract from various formats
extractCoordinates([40.7128, -74.006]); // [40.7128, -74.0060]
extractCoordinates({ lat: 40.7128, lon: -74.006 }); // [40.7128, -74.0060]
extractCoordinates({ latitude: 40.7128, longitude: -74.006 }); // [40.7128, -74.0060]

// Create GeoJSON Point
const point = createPoint([40.7128, -74.006]);
// { type: 'Point', coordinates: [-74.0060, 40.7128] }
```

### GeoJSON Operations

```typescript
import { createFeature, createFeatureCollection, getCoordinates } from '@geokit/core';

// Create features
const point = { type: 'Point', coordinates: [-74.006, 40.7128] };
const feature = createFeature(point, { name: 'New York' });

// Create feature collection
const collection = createFeatureCollection([feature]);

// Extract coordinates
const coords = getCoordinates(feature); // [-74.0060, 40.7128]
```

### String Normalization

```typescript
import { slugify, normalize, normalizeName } from '@geokit/core';

slugify('New York City'); // 'new-york-city'
normalize('Los Angeles, CA'); // 'los angeles ca'
normalizeName('Ft. Worth'); // 'fort worth'
```

### Bounding Box Operations

```typescript
import { getBounds, getCenter, isWithinBounds } from '@geokit/core';

const points = [
  [40.7128, -74.006],
  [40.758, -73.9855],
];

// Calculate bounding box
const bounds = getBounds(points); // [-74.0060, 40.7128, -73.9855, 40.7580]

// Get center point
const center = getCenter(bounds); // [40.7354, -73.99575]

// Check if point is within bounds
const checkPoint = isWithinBounds([40.7354, -73.99575]);
const isWithin = checkPoint(bounds); // true
```

### Geohashing

```typescript
import { encodeGeohash, decodeGeohash, geohashBounds, geohashNeighbors } from '@geokit/core';

// Encode coordinates to geohash
const hash = encodeGeohash([40.7128, -74.006], 9); // 'dr5regw3p'

// Decode geohash to coordinates
const coords = decodeGeohash('dr5regw3p'); // [40.7128, -74.006]

// Get geohash bounding box
const bounds = geohashBounds('dr5r'); // [minLon, minLat, maxLon, maxLat]

// Get neighboring geohashes
const neighbors = geohashNeighbors('dr5r');
// { n: 'dr5x', ne: 'dr5z', e: 'dr5p', se: 'dr5n', s: 'dr5q', sw: 'dr5m', w: 'dr5j', nw: 'dr5k' }
```

### H3 Hexagonal Indexing

```typescript
import {
  coordinatesToH3,
  h3ToCoordinates,
  h3ToBoundary,
  h3Neighbors,
  polygonToH3,
} from '@geokit/core';

// Convert coordinates to H3 index
const h3Index = coordinatesToH3([40.7128, -74.006], 9);

// Convert H3 index to coordinates
const coords = h3ToCoordinates(h3Index); // [40.7128, -74.006]

// Get hexagon boundary
const boundary = h3ToBoundary(h3Index); // Array of [lat, lon] pairs

// Get neighboring cells (k-ring)
const neighbors = h3Neighbors(h3Index, 1); // Array of H3 indices

// Fill polygon with H3 cells
const polygon = {
  type: 'Polygon',
  coordinates: [
    [
      [-74.01, 40.7],
      [-74.0, 40.7],
      [-74.0, 40.71],
      [-74.01, 40.71],
      [-74.01, 40.7],
    ],
  ],
};
const cells = polygonToH3(polygon, 9); // Array of H3 indices
```

## API Reference

### Distance

- `haversine(radius)(point1)(point2)` - Curried Haversine distance
- `haversineMeters` - Distance in meters
- `haversineKm` - Distance in kilometers
- `haversineMiles` - Distance in miles
- `withinDistance(threshold, distanceFn)` - Check if points are within threshold

### Coordinates

- `toLatLon([lon, lat])` - Convert to [lat, lon]
- `toLonLat([lat, lon])` - Convert to [lon, lat] (GeoJSON)
- `isValidCoordinate(coords)` - Validate coordinate pair
- `extractCoordinates(input)` - Extract from various formats
- `createPoint([lat, lon])` - Create GeoJSON Point

### GeoJSON

- `getCoordinates(feature|geometry)` - Extract coordinates
- `createFeature(geometry, properties?)` - Create Feature
- `createFeatureCollection(features)` - Create FeatureCollection
- `extractGeometry(feature)` - Extract geometry

### Normalize

- `slugify(text)` - Convert to URL-safe slug
- `normalize(text)` - Normalize for comparison
- `normalizeName(name)` - Normalize geographic names

### Bounds

- `getBounds(coordinates|features)` - Calculate bounding box
- `getCenter(bounds|features)` - Calculate center point
- `isWithinBounds(point)(bounds)` - Check if point is within bounds

### Geohash

- `encodeGeohash(coords, precision?)` - Encode coordinates to geohash
- `decodeGeohash(hash)` - Decode geohash to coordinates
- `geohashBounds(hash)` - Get geohash bounding box
- `geohashNeighbors(hash)` - Get neighboring geohashes
- `geohashNeighbor(hash, direction)` - Get neighbor in specific direction
- `geohashesInBounds(bounds, precision)` - Get all geohashes in bounding box
- `validateGeohash(hash)` - Validate geohash string

### H3 Hexagonal Indexing

- `coordinatesToH3(coords, resolution?)` - Convert coordinates to H3 index
- `h3ToCoordinates(h3Index)` - Convert H3 index to coordinates
- `h3ToBoundary(h3Index)` - Get hexagon boundary
- `h3Neighbors(h3Index, k?)` - Get k-ring neighbors
- `h3ToParent(h3Index, resolution)` - Get parent cell
- `h3ToChildren(h3Index, resolution)` - Get children cells
- `h3GetResolution(h3Index)` - Get resolution level
- `h3AreNeighbors(h3Index1, h3Index2)` - Check if cells are neighbors
- `polygonToH3(polygon, resolution)` - Fill polygon with H3 cells
- `h3EdgeLength(resolution)` - Get average edge length in meters
- `h3CellArea(resolution)` - Get average cell area in square meters
- `validateH3(h3Index)` - Validate H3 index

## Browser and Node.js Compatibility

This package is designed to work in both browser and Node.js environments. It uses only standard JavaScript APIs and has no platform-specific dependencies.

## Development

### Setup

```bash
yarn install
```

### Scripts

- `yarn test` - Run tests
- `yarn test:watch` - Run tests in watch mode
- `yarn typecheck` - Run TypeScript type checking
- `yarn lint` - Run ESLint
- `yarn lint:fix` - Run ESLint and fix issues
- `yarn format` - Format code with Prettier
- `yarn format:check` - Check code formatting
- `yarn build` - Build the package

### Pre-commit Hooks

This project uses Husky to enforce code quality standards before each commit:

- **Prettier** - Automatic code formatting
- **TypeScript validation** - Ensures type safety
- **ESLint** - Checks code style and catches potential issues
- **Tests** - All tests must pass before committing

The pre-commit hook will automatically run on staged files when you commit. Files will be auto-formatted, and if any validation fails, the commit will be blocked until the issues are fixed.
