# TypeScript ↔ Swift parity

Canonical Swift notes: [`geokit-swift/docs/parity.md`](../../geokit-swift/docs/parity.md).

## Module map

| Layer | TypeScript | Swift |
|-------|------------|-------|
| Core | `packages/core/src/core/`, `src/utils/*` | `GeoKitCore` |
| Turf | `src/utils/turf/` | `GeoKitCore/Utils/*` |
| Contract | `src/contract/` | `GeoKitContract` |
| UI | `src/ui/` | `GeoKitUI`, `GeoKitUIMapbox` |
| Services | `packages/service/`, `services/*/` | — |

## Fixture contract

- **File:** `geokit-swift/Tests/GeoKitCoreTests/Fixtures/parity-fixtures.json`
- **Generate:** `yarn workspace @geokit/core run export:parity-fixtures` (after `yarn build`)
- **Verify:** `yarn workspace @geokit/core run check:parity-fixtures`

## Tiers

| Tier | Scope | Parity |
|------|-------|--------|
| 1 | Bounds, distance, bearing, coordinates, H3, geohash, GeoJSON | Shared fixtures |
| 1.5 | `@geokit/core/turf` | Shared fixtures; Swift line/polygon buffers unsupported |
| 2 | `@geokit/core/contract`, `ensureMapReady` | Partial |
| 3 | Service registry, MCP tools, extended Turf | Node-only |

**Epsilon:** lat/lon ±0.0001; H3 and geohash ids exact match.

## Known differences

- Feature-collection center: Node uses Turf; Swift uses bbox center.
- `fitViewport(mapSize:)` is Swift-only.
- Node helpers are curried; Swift uses named parameters.
