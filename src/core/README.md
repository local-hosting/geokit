# @geokit/core

Slim geospatial utilities for browser and Node.js. Map UI lives in `@geokit/ui`; H3 geometry in `@geokit/h3`; env keys in `@geokit/env`. See [docs/architecture.md](../../docs/architecture.md) for package layout and import tiers.

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
yarn add geokit
```

Published on npm. Install with your package manager of choice.

## Usage

### Distance Calculations

```typescript
import {
  haversineMeters,
  haversineKm,
  haversineMiles,
  vincentyMeters,
  greatCircleMeters,
  rhumbLineMeters,
  withinDistance,
} from 'geokit';

const nyc = [40.7128, -74.006];
const la = [34.0522, -118.2437];

// Haversine formula (most common, good balance of speed and accuracy)
const distance = haversineMeters(nyc)(la); // ~3,944,000 meters
const distanceKm = haversineKm(nyc)(la); // ~3,944 km
const distanceMiles = haversineMiles(nyc)(la); // ~2,449 miles

// Vincenty formula (most accurate, slower)
const accurateDistance = vincentyMeters(nyc)(la);

// Great circle (simple and fast)
const simpleDistance = greatCircleMeters(nyc)(la);

// Rhumb line (constant bearing)
const rhumbDistance = rhumbLineMeters(nyc)(la);

// Using curried functions for composition
const distanceFromNYC = haversineMeters(nyc);
const toLA = distanceFromNYC(la);
const toChicago = distanceFromNYC([41.8781, -87.6298]);

// Check if points are within a threshold
const checkWithin1km = withinDistance(1000, haversineMeters);
const isClose = checkWithin1km(nyc)([40.713, -74.0062]); // true

// Filter points within radius
const nearbyPoints = [
  [40.713, -74.0062],
  [40.72, -74.01],
  [40.8, -74.1], // Too far
];
const within1km = nearbyPoints.filter((point) => checkWithin1km(nyc)(point));
```

### Coordinate Conversions

```typescript
import {
  toLatLon,
  toLonLat,
  isValidCoordinate,
  extractCoordinates,
  createPoint,
  serializeCoordinates,
  deserializeCoordinates,
} from 'geokit';

// Convert between [lat, lon] and [lon, lat] formats
const geojsonCoords = toLonLat([40.7128, -74.006]); // [-74.0060, 40.7128]
const latLonCoords = toLatLon([-74.006, 40.7128]); // [40.7128, -74.0060]

// Validate coordinates
isValidCoordinate([40.7128, -74.006]); // true
isValidCoordinate([91, -74.006]); // false (latitude out of range)
isValidCoordinate([40.7128, 200]); // false (longitude out of range)

// Extract from various formats (auto-detects format)
extractCoordinates([40.7128, -74.006]); // [40.7128, -74.0060]
extractCoordinates([-74.006, 40.7128]); // [40.7128, -74.0060] (auto-converts)
extractCoordinates({ lat: 40.7128, lon: -74.006 }); // [40.7128, -74.0060]
extractCoordinates({ latitude: 40.7128, longitude: -74.006 }); // [40.7128, -74.0060]

// Extract from GeoJSON Point
const geoJsonPoint = {
  type: 'Point',
  coordinates: [-74.006, 40.7128], // [lon, lat]
};
extractCoordinates(geoJsonPoint); // [40.7128, -74.0060]

// Create GeoJSON Point
const point = createPoint([40.7128, -74.006]);
// { type: 'Point', coordinates: [-74.0060, 40.7128] }

// Serialize/deserialize coordinates
const json = serializeCoordinates([40.7128, -74.006]);
// '{"lat":40.7128,"lon":-74.006}'
const coords = deserializeCoordinates(json); // [40.7128, -74.0060]
```

### GeoJSON Operations

```typescript
import {
  createFeature,
  createFeatureCollection,
  getCoordinates,
  extractGeometry,
} from 'geokit';

// Create features
const point = { type: 'Point', coordinates: [-74.006, 40.7128] };
const feature = createFeature(point, { name: 'New York', population: 8336817 });

// Create feature collection
const features = [
  createFeature(point, { name: 'New York' }),
  createFeature({ type: 'Point', coordinates: [-118.2437, 34.0522] }, { name: 'Los Angeles' }),
];
const collection = createFeatureCollection(features);

// Extract coordinates from feature or geometry
const coords = getCoordinates(feature); // [-74.0060, 40.7128]
const geometry = extractGeometry(feature); // { type: 'Point', coordinates: [...] }
```

### Geometry Operations

```typescript
import {
  polygonCentroid,
  pointsCentroid,
  convexHull,
  lineIntersection,
  bufferPoint,
  bufferLine,
  bufferPolygon,
} from 'geokit';

// Calculate centroids
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
const centroid = polygonCentroid(polygon); // [40.705, -74.005]

const points = [
  [40.7128, -74.006],
  [40.758, -73.9855],
  [40.75, -73.98],
];
const pointsCenter = pointsCentroid(points); // [40.7403, -73.9905]

// Convex hull
const hull = convexHull(points);
// Returns polygon representing the convex hull

// Line intersection
const line1 = [
  [40.7128, -74.006],
  [40.758, -73.9855],
];
const line2 = [
  [40.72, -74.0],
  [40.75, -73.99],
];
const intersection = lineIntersection(line1, line2); // Intersection point or null

// Create buffers (zones around geometries)
const pointBuffer = bufferPoint([40.7128, -74.006], 1000); // 1km buffer
const lineBuffer = bufferLine(line1, 500); // 500m buffer around line
const polygonBuffer = bufferPolygon(polygon, 200); // 200m buffer around polygon
```

### Measurements

```typescript
import {
  lineLengthMeters,
  lineLengthKm,
  perimeterMeters,
  polygonArea,
  polygonAreaKm,
  circleArea,
  boundsArea,
} from 'geokit';

// Calculate line/polyline length
const route = [
  [40.7128, -74.006],
  [40.758, -73.9855],
  [40.75, -73.98],
];
const length = lineLengthMeters(route); // Length in meters
const lengthKm = lineLengthKm(route); // Length in kilometers

// Calculate polygon perimeter
const perimeter = perimeterMeters(polygon); // Perimeter in meters

// Calculate areas
const area = polygonArea(polygon); // Area in square meters
const areaKm = polygonAreaKm(polygon); // Area in square kilometers

const circleAreaM2 = circleArea(1000); // Area of circle with 1000m radius
const bounds = getBounds(points);
const boundsAreaM2 = boundsArea(bounds); // Area of bounding box
```

### Bearing and Navigation

```typescript
import {
  bearing,
  finalBearing,
  midpoint,
  destinationMeters,
  destinationKm,
} from 'geokit';

const nyc = [40.7128, -74.006];
const la = [34.0522, -118.2437];

// Calculate initial bearing (direction to travel)
const initialBearing = bearing(nyc)(la); // ~260 degrees (west-southwest)

// Calculate final bearing (direction when arriving)
const arrivalBearing = finalBearing(nyc)(la);

// Calculate midpoint
const mid = midpoint(nyc)(la); // [37.3825, -96.12485]

// Calculate destination point
const move1kmEast = destinationMeters(1000, 90); // 1km east
const newLocation = move1kmEast(nyc); // [40.7128, -73.995]

const move5kmNorth = destinationKm(5, 0); // 5km north
const northLocation = move5kmNorth(nyc);
```

### Clustering

```typescript
import { gridCluster, gridClusterMeters, distanceCluster } from 'geokit';

const points = [
  { location: [40.7128, -74.006], data: { name: 'Point 1' } },
  { location: [40.713, -74.007], data: { name: 'Point 2' } },
  { location: [40.8, -73.9], data: { name: 'Point 3' } },
];

// Grid-based clustering
const gridClusters = gridClusterMeters(1000, points); // 1km grid cells
// Returns clusters with center points and member points

// Distance-based clustering
const distanceClusters = distanceCluster(500, points); // 500m threshold
// Groups points within 500m of each other
```

### Spatial Index Interoperability

```typescript
import {
  // Type guards
  isGeohash,
  isH3,
  getSpatialIndexType,
  // Constructors
  asGeohashPoint,
  asH3Point,
  // Conversions
  geohashPointToH3Point,
  h3PointToGeohashPoint,
  // Universal functions
  decodePointToCoordinates,
  getBoundsFromPoint,
} from 'geokit';

// Identify spatial index type
getSpatialIndexType('dr5regw3p'); // 'geohash'
getSpatialIndexType('892a1072c97ffff'); // 'h3'

// Create type-safe spatial indices
const geohashPt = asGeohashPoint('dr5regw3p');
const h3Pt = asH3Point('892a1072c97ffff');

// Convert between geohash and H3
const h3FromGeohash = geohashPointToH3Point(geohashPt, 9);
const geohashFromH3 = h3PointToGeohashPoint(h3Pt, 10);

// Universal functions work with both types
const coords = decodePointToCoordinates(geohashPt); // Works with GeohashPoint
const coords2 = decodePointToCoordinates(h3Pt); // Works with H3Point

const bounds1 = getBoundsFromPoint(geohashPt);
const bounds2 = getBoundsFromPoint(h3Pt);
```

### Coordinate Format Conversions (DMS)

```typescript
import {
  toDMS,
  fromDMS,
  coordinatesToDMS,
  formatDMS,
  toRadians,
  toDegrees,
  normalizeLongitude,
  normalizeLatitude,
} from 'geokit';

// Convert decimal degrees to DMS (Degrees, Minutes, Seconds)
const dms = toDMS(40.7128); // { degrees: 40, minutes: 42, seconds: 46.08 }
const formatted = formatDMS(dms); // "40°42'46.08\""

// Convert coordinates to DMS
const coordsDMS = coordinatesToDMS([40.7128, -74.006]);
// { lat: { degrees: 40, minutes: 42, seconds: 46.08 }, lon: {...} }

// Convert DMS to decimal degrees
const decimal = fromDMS({ degrees: 40, minutes: 42, seconds: 46.08 }); // 40.7128

// Convert between radians and degrees
const radians = toRadians(90); // π/2
const degrees = toDegrees(Math.PI / 2); // 90

// Normalize coordinates to valid ranges
const normalizedLon = normalizeLongitude(185); // -175 (wraps around)
const normalizedLat = normalizeLatitude(95); // 90 (clamped)
```

### String Normalization

```typescript
import { slugify, normalize, normalizeName } from 'geokit';

slugify('New York City'); // 'new-york-city'
slugify('Los Angeles, CA'); // 'los-angeles-ca'

normalize('Los Angeles, CA'); // 'los angeles ca'
normalize('  New   York  '); // 'new york'

normalizeName('Ft. Worth'); // 'fort worth'
normalizeName('St. Louis'); // 'saint louis'
normalizeName('Mt. Everest'); // 'mount everest'
```

### Geohashing

```typescript
import {
  encodeGeohash,
  decodeGeohash,
  geohashBounds,
  geohashNeighbors,
  geohashNeighborsArray,
  geohashNeighbor,
  geohashesInBounds,
  validateGeohash,
  // Type-safe functions
  encodeGeohashPoint,
  decodeGeohashPoint,
  geohashPointNeighbors,
} from 'geokit';

// Encode coordinates to geohash
const hash = encodeGeohash([40.7128, -74.006], 9); // 'dr5regw3p'
const hash10 = encodeGeohash([40.7128, -74.006]); // Default precision 10

// Decode geohash to coordinates
const coords = decodeGeohash('dr5regw3p'); // [40.7128, -74.006]

// Get geohash bounding box
const bounds = geohashBounds('dr5r'); // [minLon, minLat, maxLon, maxLat]

// Get neighboring geohashes
const neighbors = geohashNeighbors('dr5r');
// { n: 'dr5x', ne: 'dr5z', e: 'dr5p', se: 'dr5n', s: 'dr5q', sw: 'dr5m', w: 'dr5j', nw: 'dr5k' }

const neighborsArray = geohashNeighborsArray('dr5r'); // Array of 8 neighbors
const northNeighbor = geohashNeighbor('dr5r', 'n'); // 'dr5x'

// Get all geohashes covering a bounding box
const areaBounds = [-74.01, 40.7, -74.0, 40.71];
const coveringHashes = geohashesInBounds(areaBounds, 7); // Array of geohashes

// Validate geohash
validateGeohash('dr5regw3p'); // true
validateGeohash('invalid!'); // false

// Type-safe geohash functions
const geohashPoint = encodeGeohashPoint([40.7128, -74.006], 9);
const decoded = decodeGeohashPoint(geohashPoint);
const pointNeighbors = geohashPointNeighbors(geohashPoint); // Array of 8 neighbors
```

### H3 Hexagonal Indexing

```typescript
import {
  coordinatesToH3,
  h3ToCoordinates,
  h3ToBoundary,
  h3ToPolygon,
  h3Neighbors,
  snapToH3Cell,
  polygonToH3,
  h3SetToMultiPolygon,
  h3ToParent,
  h3ToChildren,
  h3GetResolution,
  // Type-safe functions
  coordinatesToH3Point,
  h3PointToPolygon,
} from 'geokit';

// Convert coordinates to H3 index
const h3Index = coordinatesToH3([40.7128, -74.006], 9);
const resolution = h3GetResolution(h3Index); // 9

// Convert H3 index to coordinates (center of cell)
const coords = h3ToCoordinates(h3Index); // [40.7128, -74.006]

// Snap coordinates to nearest H3 cell center
const snapped = snapToH3Cell([40.7128, -74.006], 9);

// Get hexagon boundary as array of coordinates
const boundary = h3ToBoundary(h3Index); // Array of [lat, lon] pairs

// Get hexagon as GeoJSON Polygon
const polygon = h3ToPolygon(h3Index);
// { type: 'Polygon', coordinates: [[[lon, lat], ...]] }

// Get neighboring cells (k-ring)
const neighbors = h3Neighbors(h3Index, 1); // 1-ring (7 cells including center)
const neighbors2 = h3Neighbors(h3Index, 2); // 2-ring (19 cells)

// Work with cell hierarchy
const parent = h3ToParent(h3Index, 8); // Parent at resolution 8
const children = h3ToChildren(h3Index, 10); // Children at resolution 10

// Fill polygon with H3 cells
const area = {
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
const cells = polygonToH3(area, 9); // Array of H3 indices covering the polygon

// Convert multiple H3 cells to MultiPolygon
const multiPolygon = h3SetToMultiPolygon(cells);
// { type: 'MultiPolygon', coordinates: [...] }

// Type-safe H3 functions (branded types)
const h3Point = coordinatesToH3Point([40.7128, -74.006], 9);
const h3Polygon = h3PointToPolygon(h3Point); // Type-safe conversion
```

### Interpolation and Resampling

```typescript
import {
  interpolate,
  interpolateMeters,
  nearestPointOnLine,
  nearestPointOnPolyline,
  resample,
} from 'geokit';

const start = [40.7128, -74.006];
const end = [40.758, -73.9855];

// Interpolate along a line
const midpoint = interpolate(0.5)(start)(end); // 50% along the line
const quarterPoint = interpolate(0.25)(start)(end); // 25% along

// Interpolate at specific distance
const at1km = interpolateMeters(1000);
const point1km = at1km(start)(end); // Point 1km from start

// Find nearest point on line segment
const findNearest = nearestPointOnLine([40.72, -74.0]);
const nearest = findNearest(start)(end); // Nearest point on segment

// Find nearest point on polyline
const route = [
  [40.7128, -74.006],
  [40.72, -74.0],
  [40.758, -73.9855],
];
const result = nearestPointOnPolyline([40.715, -74.003])(route);
// { point: [lat, lon], segmentIndex: 0, distance: 123.45 }

// Resample polyline at regular intervals
const resampled = resample(1000)(route); // Points every 1km
```

### Containment Checks

```typescript
import { pointInPolygon, pointInCircle, boundsContains } from 'geokit';

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

// Check if point is in polygon
const checkInPolygon = pointInPolygon([40.705, -74.005]);
const isInside = checkInPolygon(polygon); // true

// Check if point is in circle
const checkInCircle = pointInCircle(1000); // 1km radius
const isInCircle = checkInCircle([40.7128, -74.006])([40.713, -74.007]); // true

// Check if bounds contain another bounds
const outerBounds = [-74.02, 40.69, -73.99, 40.72];
const innerBounds = [-74.01, 40.7, -74.0, 40.71];
const contains = boundsContains(outerBounds)(innerBounds); // true
```

### Simplification

```typescript
import { simplify, simplifyMeters } from 'geokit';

const complexRoute = [
  [40.7128, -74.006],
  [40.7129, -74.0061],
  [40.713, -74.0062],
  [40.7131, -74.0063],
  // ... many more points
];

// Simplify using Douglas-Peucker algorithm
const simplified = simplify(0.001)(complexRoute); // Tolerance in degrees
const simplifiedMeters = simplifyMeters(100)(complexRoute); // 100m tolerance
```

### Real-World Example: Finding Nearby Points

```typescript
import {
  haversineMeters,
  withinDistance,
  extractCoordinates,
  isValidCoordinate,
} from 'geokit';

// User location
const userLocation = [40.7128, -74.006];

// Points of interest (various formats)
const pois = [
  { name: 'Cafe', location: [40.713, -74.007] },
  { name: 'Park', location: { lat: 40.72, lon: -73.99 } },
  { name: 'Museum', location: [-73.985, 40.758] }, // [lon, lat] format
];

// Find points within 1km
const within1km = withinDistance(1000, haversineMeters);
const nearby = pois
  .map((poi) => ({
    ...poi,
    location: extractCoordinates(poi.location),
  }))
  .filter((poi) => isValidCoordinate(poi.location))
  .filter((poi) => within1km(userLocation)(poi.location))
  .map((poi) => ({
    ...poi,
    distance: haversineMeters(userLocation)(poi.location),
  }))
  .sort((a, b) => a.distance - b.distance);
```

## API Reference

### Distance

- `haversine(radius)(point1)(point2)` - Curried Haversine distance
- `haversineMeters(point1)(point2)` - Distance in meters
- `haversineKm(point1)(point2)` - Distance in kilometers
- `haversineMiles(point1)(point2)` - Distance in miles
- `vincentyMeters(point1)(point2)` - Most accurate distance in meters
- `greatCircleMeters(point1)(point2)` - Simple great circle distance
- `rhumbLineMeters(point1)(point2)` - Constant bearing distance
- `withinDistance(threshold, distanceFn)` - Check if points are within threshold

### Coordinates

- `toLatLon([lon, lat])` - Convert to [lat, lon]
- `toLonLat([lat, lon])` - Convert to [lon, lat] (GeoJSON)
- `isValidCoordinate(coords)` - Validate coordinate pair
- `extractCoordinates(input)` - Extract from various formats
- `createPoint([lat, lon])` - Create GeoJSON Point
- `serializeCoordinates(coords)` - Serialize to JSON string
- `deserializeCoordinates(json)` - Deserialize from JSON string

### Coordinate Conversions (DMS)

- `toDMS(decimal)` - Convert decimal degrees to DMS
- `fromDMS(dms)` - Convert DMS to decimal degrees
- `coordinatesToDMS(coords)` - Convert coordinates to DMS format
- `formatDMS(dms)` - Format DMS as string
- `toRadians(degrees)` - Convert degrees to radians
- `toDegrees(radians)` - Convert radians to degrees
- `normalizeLongitude(lon)` - Normalize longitude to [-180, 180]
- `normalizeLatitude(lat)` - Normalize latitude to [-90, 90]

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

### Bearing and Navigation

- `bearing(point1)(point2)` - Initial bearing between points
- `finalBearing(point1)(point2)` - Final bearing at destination
- `midpoint(point1)(point2)` - Midpoint between two points
- `destination(distance, bearing, radius)(point)` - Destination point
- `destinationMeters(distance, bearing)(point)` - Destination in meters
- `destinationKm(distance, bearing)(point)` - Destination in kilometers
- `destinationMiles(distance, bearing)(point)` - Destination in miles

### Geometry Operations

- `polygonCentroid(polygon)` - Calculate polygon centroid
- `pointsCentroid(points)` - Calculate points centroid
- `convexHull(points)` - Calculate convex hull
- `lineIntersection(line1, line2)` - Find line intersection
- `bufferPoint(point, radius)` - Create buffer around point
- `bufferLine(line, radius)` - Create buffer around line
- `bufferPolygon(polygon, radius)` - Create buffer around polygon

### Measurements

- `lineLength(distanceFn)(polyline)` - Line length with custom distance
- `lineLengthMeters(polyline)` - Line length in meters
- `lineLengthKm(polyline)` - Line length in kilometers
- `perimeterMeters(polygon)` - Polygon perimeter in meters
- `polygonArea(polygon)` - Polygon area in square meters
- `circleArea(radius)` - Circle area in square meters
- `boundsArea(bounds)` - Bounding box area in square meters

### Containment

- `pointInPolygon(point)(polygon)` - Check if point in polygon
- `pointInCircle(radius)(center)(point)` - Check if point in circle
- `boundsContains(outerBounds)(innerBounds)` - Check bounds containment

### Interpolation

- `interpolate(fraction)(start)(end)` - Interpolate along line
- `interpolateMeters(distance)(start)(end)` - Interpolate at distance
- `nearestPointOnLine(point)(start)(end)` - Nearest point on segment
- `nearestPointOnPolyline(point)(polyline)` - Nearest point on polyline
- `resample(interval)(polyline)` - Resample at regular intervals

### Simplification

- `simplify(tolerance)(polyline)` - Simplify using Douglas-Peucker
- `simplifyMeters(tolerance)(polyline)` - Simplify with meter tolerance

### Clustering

- `gridCluster(cellSize, points)` - Grid-based clustering
- `gridClusterMeters(cellSize, points)` - Grid clustering in meters
- `distanceCluster(threshold, points)` - Distance-based clustering

### Geohash

- `encodeGeohash(coords, precision?)` - Encode coordinates to geohash
- `decodeGeohash(hash)` - Decode geohash to coordinates
- `geohashBounds(hash)` - Get geohash bounding box
- `geohashNeighbors(hash)` - Get neighboring geohashes (object)
- `geohashNeighborsArray(hash)` - Get neighboring geohashes (array)
- `geohashNeighbor(hash, direction)` - Get neighbor in specific direction
- `geohashesInBounds(bounds, precision)` - Get all geohashes in bounding box
- `validateGeohash(hash)` - Validate geohash string
- `encodeGeohashPoint(coords, precision?)` - Type-safe encode (returns GeohashPoint)
- `decodeGeohashPoint(hash)` - Type-safe decode (takes GeohashPoint)
- `geohashPointNeighbors(hash)` - Type-safe neighbors (returns GeohashPoint[])

### H3 Hexagonal Indexing

> H3 APIs moved to `@geokit/h3`. `@geokit/core/h3` shims remain for one release.

- `coordinatesToH3(coords, resolution?)` - Convert coordinates to H3 index
- `h3ToCoordinates(h3Index)` - Convert H3 index to coordinates
- `h3ToBoundary(h3Index)` - Get hexagon boundary as coordinates
- `h3ToPolygon(h3Index)` - Get hexagon as GeoJSON Polygon
- `h3Neighbors(h3Index, k?)` - Get k-ring neighbors
- `snapToH3Cell(coords, resolution?)` - Snap coordinates to cell center
- `h3ToParent(h3Index, resolution)` - Get parent cell
- `h3ToChildren(h3Index, resolution)` - Get children cells
- `h3GetResolution(h3Index)` - Get resolution level
- `h3AreNeighbors(h3Index1, h3Index2)` - Check if cells are neighbors
- `polygonToH3(polygon, resolution)` - Fill polygon with H3 cells
- `h3SetToMultiPolygon(h3Indices)` - Convert H3 cells to MultiPolygon
- `h3EdgeLength(resolution)` - Get average edge length in meters
- `h3CellArea(resolution)` - Get average cell area in square meters
- `validateH3(h3Index)` - Validate H3 index
- `coordinatesToH3Point(coords, resolution?)` - Type-safe encode (returns H3Point)
- `h3PointToPolygon(h3Index)` - Type-safe conversion to Polygon

### Spatial Index Interoperability

- `isGeohash(value)` - Check if string is geohash
- `isH3(value)` - Check if string is H3 index
- `getSpatialIndexType(value)` - Get type: 'geohash' | 'h3' | 'unknown'
- `asGeohashPoint(hash)` - Create GeohashPoint (with validation)
- `asH3Point(index)` - Create H3Point (with validation)
- `geohashPointToH3Point(geohash, resolution)` - Convert geohash to H3
- `h3PointToGeohashPoint(h3, precision)` - Convert H3 to geohash
- `decodePointToCoordinates(index)` - Universal decode — import from `@geokit/core/spatial/decode`
- `getBoundsFromPoint(index)` - Universal bounds — import from `@geokit/core/spatial/decode`

## Browser and Node.js Compatibility

This package is designed to work in both browser and Node.js environments. It uses only standard JavaScript APIs and has no platform-specific dependencies.

## Map UI (Web Components)

Import from `@geokit/ui`. Custom elements (`gk-map`, `gk-point`, `gk-layer`, …) emit `gk-*` events for app integration.

See [docs/events.md](../../docs/events.md) for the event reference.

## Development

### Setup

```bash
yarn install
```

### Scripts

- `yarn test` - Run tests in Node.js environment
- `yarn test:node` - Run tests in Node.js environment (explicit)
- `yarn test:browser` - Run tests in browser environment (jsdom)
- `yarn test:all` - Run tests in both Node.js and browser environments
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


## Swift parity

GeoKit Swift (`geokit-swift`) shares core geo math via fixture tests.

- [Architecture](../../docs/architecture.md) — services, plugins, UI providers
- [Parity](../../docs/parity.md) — TypeScript ↔ Swift layout and fixtures
- [Providers](../../docs/providers.md) — MapTiler / Mapbox / Apple map backends
- [Events](../../docs/events.md) — `gk-*` custom events

```bash
yarn verify:parity   # build + fixture check + Swift GeoKitCoreTests
```
