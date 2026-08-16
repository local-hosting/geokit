# Node vs Swift GeoKit parity

This document mirrors [`geokit-swift/docs/parity.md`](../geokit-swift/docs/parity.md). **geokit-swift** is the canonical copy for Swift-specific notes; this file is the TypeScript entry point.

## Fixture contract

- **File:** `geokit-swift/Tests/GeoKitCoreTests/Fixtures/parity-fixtures.json`
- **Version:** 4 (`turf.*` groups)
- **Generate:** `yarn export:parity-fixtures` (requires `yarn build` first — script reads `dist/esm`)
- **Verify:** `yarn check:parity-fixtures`
- **Swift tests:** `swift test --filter GeoKitCoreTests` (from `packages/geokit-swift`)

## Tier 1 — shared fixtures

Bounds, distance, bearing, coordinates, H3, geohash, GeoJSON. See `src/core/` and per-module `src/utils/*` READMEs.

**Epsilon:** lat/lon ±0.0001; H3 and geohash ids exact match.

## Tier 1.5 — Turf-backed geometry

Exported from `@geokit/turf` (`src/utils/turf/`). Fixtures under `turf.*`.

**Swift gaps:** line/polygon buffers unsupported (`BufferError.unsupportedGeometry`).

## Tier 2 — map UI lifecycle

`@geokit/contract`, `ensureMapReady`, placeholder/snapshot/live phases. Partial API parity with `GeoKitContract` + `GeoKitUI`.

## Tier 3 — Node-only (out of scope)

CDN choropleth, Globe layer datasets, MCP map tools, full provider registry surface, extended Turf suite (union/difference/simplify/clustering). Host apps use `@twinfile/globe-static` for CDN.

## Known differences

- `getCenter` on feature collections: Node uses Turf; Swift uses bbox center.
- `fitViewport(mapSize:)` is Swift-only.
- Node helpers are curried; Swift uses named parameters.
- Point buffer ring density differs (Turf.js vs turf-swift).

See also [`providers.md`](providers.md).
