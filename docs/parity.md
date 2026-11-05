# TypeScript ↔ Swift parity

Canonical Swift notes: [`geokit-swift/docs/parity.md`](../../geokit-swift/docs/parity.md).

## Module map

| Layer | TypeScript | Swift |
|-------|------------|-------|
| Core utils | `src/core/src/utils/*` | `GeoKitCore` |
| H3 | `src/h3/src/` | `GeoKitCore` H3 subset |
| Turf | `src/core/src/utils/turf/` | `GeoKitCore/Utils/*` |
| Contract | `src/core/src/contract/` | `GeoKitContract` |
| UI | `src/ui/src/` | `GeoKitUI`, `GeoKitUIMapbox` |
| Env | `src/env/src/` | — |
| Services | `src/service/`, `src/providers/*/` | — |

## Fixture contract

- **File:** `geokit-swift/Tests/GeoKitCoreTests/Fixtures/parity-fixtures.json`
- **Full verify (Twinfile layout):** `bash geokit/src/core/scripts/verify-parity.sh` from repo root (builds core, exports fixtures, runs Swift `GeoKitCoreTests`)
- **Export only:** after `yarn build:h3 && yarn build:core:bundle` in `geokit/`, run `node geokit/src/core/scripts/export-parity-fixtures.mjs` → fixture path above (requires `@twinfile/geokit` self-link under `geokit/node_modules/` — `verify-parity.sh` creates it)
- **Drift check:** `node geokit/src/core/scripts/check-parity-fixtures.mjs` from `geokit/src/core/` (after core dist exists)

## API cheat sheet (cross-platform)

Use **GeoKit wrappers** on both platforms for behavior locked by `parity-fixtures.json`. Both Tier 1.5 stacks use Turf (Turf.js on Node, [turf-swift](https://github.com/mapbox/turf-swift) on Swift via `TurfBridge`).

### Package imports

| Concern | TypeScript | Swift |
|---------|------------|--------|
| Core geo (Tier 1) | `@twinfile/geokit/core/bounds`, `…/bearing`, `…/distance`, `…/coordinates`, `…/geohash`, `…/geojson` | `import GeoKitCore` → `BoundsCalculator`, `Bearing`, `Distance`, `Coordinates`, `Geohash`, `GeoJSON*` |
| H3 | `@twinfile/geokit/h3` | `GeoKitCore` → `H3` |
| Turf bucket (Tier 1.5) | `@twinfile/geokit/core/turf` | `GeoKitCore` → `Containment`, `Centroid`, `Area`, `Length`, `Buffer`, `Conversions`, `BoundsGeo`, `CoordinateExtraction` |
| Map contract (Tier 2) | `@twinfile/geokit/core/contract` | `GeoKitContract` |
| Map UI (Tier 2) | `@twinfile/geokit/ui` | `GeoKitUI`, `GeoKitUIMapbox` |

### Call style

| TypeScript | Swift |
|------------|--------|
| Curried helpers: `midpoint(from)(to)`, `pointInPolygon(point)(polygon)` | Static methods + labels: `Bearing.midpoint(from:to:)`, `Containment.isPointInPolygon(_:polygon:)` |
| `[lat, lon]` tuples / `LatLon` objects per export | `LatLon(latitude:longitude:)` and `[Double]` bounds `[minLon, minLat, maxLon, maxLat]` |

### Tier 1 — same fixtures

| TypeScript (typical import path) | Swift |
|----------------------------------|--------|
| `calculateCenterAndZoom`, `calculateZoomFromBounds`, `getBounds`, `getCenter` — `@twinfile/geokit/core/bounds` | `BoundsCalculator.*`, `BoundsGeo.getBounds(from:)`, **`BoundsGeo.getCenter(from:)`** (Turf bbox center, like `@turf/center`) |
| `haversineMeters`, `withinDistance` — `…/core/distance` | `Distance.haversineMeters(from:to:)`, `.withinDistance(_:from:to:)` |
| `bearing`, `finalBearing`, `midpoint`, `destinationMeters` — `…/core/bearing` | `Bearing.initial(from:to:)`, `.final(from:to:)`, `.midpoint(from:to:)`, `.destinationMeters(from:distance:bearingDegrees:)` |
| `isValidCoordinate`, `toLatLon`, `toLonLat` — `…/core/coordinates` | `Coordinates.isValid`, `.toLatLon`, `.toLonLat`, array helpers |
| `coordinatesToH3`, `h3ToParent`, … — `@twinfile/geokit/h3` | `H3.coordinatesToCell`, `.parent(of:resolution:)`, `.children`, `.neighbors`, … |
| `encodeGeohash`, `decodeGeohash`, … — `…/core/geohash` | `Geohash.encode`, `.decode`, `.bounds`, `.neighbors`, `.isValid` |
| `getFeatureId`, `validateGeoJSON`, `repairGeometry` — `…/core/geojson` | `GeoJSONHelpers`, `GeoJSONValidation`, `GeoJSONRepair` |

Example (center + distance):

```ts
import { calculateCenterAndZoom } from '@twinfile/geokit/core/bounds';
import { haversineMeters } from '@twinfile/geokit/core/distance';

const { center, zoom } = calculateCenterAndZoom([-74.1, 40.6, -73.9, 40.8]);
const meters = haversineMeters([40.7128, -74.006], [34.0522, -118.2437]);
```

```swift
import GeoKitCore

let centerZoom = BoundsCalculator.centerAndZoom(from: [-74.1, 40.6, -73.9, 40.8])
let meters = Distance.haversineMeters(
    from: LatLon(latitude: 40.7128, longitude: -74.006),
    to: LatLon(latitude: 34.0522, longitude: -118.2437)
)
```

### Tier 1.5 — `@twinfile/geokit/core/turf` ↔ GeoKitCore + turf-swift

| TypeScript (`core/turf` barrel) | Swift |
|-----------------------------------|--------|
| `isPointInPolygon`, `boundsContains`, `boundsIntersects` | `Containment.isPointInPolygon`, `.isPointInBounds`, `.doBoundsIntersect` |
| `polygonCentroid`, `pointsCentroid` | `Centroid.polygonCentroid`, `.pointsCentroid` |
| `polygonArea`, `boundsArea` | `Area.polygonArea`, `.boundsArea` |
| `lineLengthMeters`, `perimeterMeters` | `Length.lineLengthMeters`, `.perimeterMeters` |
| `bufferPoint` | `Buffer.bufferPoint` |
| `toDMS`, `fromDMS`, `coordinatesToDMS` | `Conversions.toDMS`, `.fromDMS`, `.coordinatesToDMS` |
| `bboxToPolygon`, `getBounds(geometry)` | `BoundsGeo.bboxToPolygon`, `.getBounds(from:)`, `.getCenter(from:)` |
| `bufferLine`, `bufferPolygon`, `buffer` — `@twinfile/geokit/core/turf` (Node) | Swift: unsupported — use Node or `Buffer.bufferPoint` only |
| `detectAndConvertCoordinateFormat`, `extractCoordinates` | `CoordinateExtraction.*` |

Example (containment + point buffer):

```ts
import { isPointInPolygon, bufferPoint } from '@twinfile/geokit/core/turf';

const inside = isPointInPolygon([40.705, -74.008])(polygon);
const circle = bufferPoint([40.7128, -74.006], 500);
```

```swift
import GeoKitCore

let inside = Containment.isPointInPolygon(point, polygon: polygon)
let circle = try Buffer.bufferPoint(point, radiusMeters: 500)
```

**Cross-platform Turf rules**

- Import **`@twinfile/geokit/core/turf`** on Node for containment, measure, **`getCenter`**, **`getBounds(geometry)`**, and point buffers; line/polygon buffers are exported there too (**Node-only**).
- Prefer **`bufferPoint` only** for shared geometry; Swift throws on line/polygon buffer.
- Expect **small numeric drift** on area/length/point-buffer rings; fixtures use looser epsilons than Tier 1.
- Do not rely on raw `@turf/*` or `import Turf` for parity claims — use the GeoKit modules above.

### Tier 2 — conceptual mirror (no fixture suite)

| TypeScript | Swift |
|------------|--------|
| `ensureMapReady`, map bootstrap | `GeoKitMapBootstrap`, `GeoKitMapLifecycle` |
| placeholder / snapshot / live phases | `MapContentPhase`, `MapContentPhaseResolver`, `GeoKitMapContentWithLifecycle` |
| `GeoKitMapLifecycleConstants` / freeze timing | `GeoKitMapLifecycleConstants`, `GeoKitMapLifecycle` |

Detail: [`geokit-swift/docs/parity.md`](../../geokit-swift/docs/parity.md) (providers, platforms, v5 helpers).

### Node-only (do not expect on Swift)

`@twinfile/geokit/service`, `@twinfile/geokit/crosswalk`, MCP map tools, extended Turf (union, difference, simplify, clustering), `bufferLine` / `bufferPolygon`.

## Tiers

| Tier | Scope | Parity |
|------|-------|--------|
| 1 | Bounds, distance, bearing, coordinates, geohash, GeoJSON | Shared fixtures |
| 1 | H3 (`@twinfile/geokit/h3`) | Shared fixtures where Swift implements H3 |
| 1.5 | `@twinfile/geokit/core/turf` | Shared fixtures; Swift line/polygon buffers unsupported |
| 2 | `@twinfile/geokit/core/contract`, `ensureMapReady` (`@twinfile/geokit/ui`) | Partial |
| 3 | Service registry, MCP tools, extended Turf, `@twinfile/geokit/crosswalk` | Node-only |

**Epsilon:** lat/lon ±0.0001; H3 and geohash ids exact match.

## Known differences

- `getCenter` on bounds and coordinate sets uses Turf bbox center on both sides (`BoundsGeo.getCenter` ↔ `@turf/center` via `get-center.ts`). For exotic feature collections, validate in app tests if you need centroid vs bbox center.
- `fitViewport(mapSize:)` is Swift-only size-aware zoom.
- Node helpers are curried; Swift uses named parameters.
