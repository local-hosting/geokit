# GeoKit module map (TypeScript ↔ Swift)

Cross-platform layout for `geokit` and **geokit-swift**. See [`parity.md`](parity.md) for fixture tiers.

## Layer model

| Layer | TypeScript | Swift SPM target | Role |
|-------|------------|------------------|------|
| Core | `src/core/`, `src/utils/*` | `GeoKitCore` | Geo math, types, constants |
| Turf | `src/utils/turf/` | `GeoKitCore/Utils/*` | Measurement & containment (Tier 1.5) |
| Contract | `src/contract/` | `GeoKitContract` | Map lifecycle, provider ids, bootstrap |
| UI | `src/ui/` | `GeoKitUI` | Map components, theme, layer stack |
| API plugins | `packages/api/`, `packages/plugin-*/` | — | HTTP: place search, geocoding, isochrones |
| UI providers | `src/ui/providers/` | `GeoKitUIMapbox`, `GeoKitUI/Providers/` | Map rendering: MapTiler, Mapbox, Apple |

## Core (Tier 1)

| Node export | TS path | Swift path | Fixture |
|-------------|---------|------------|---------|
| `@geokit/core` or `@geokit/bounds` | `src/core/`, `src/utils/bounds/` | `GeoKitCore/Utils/bounds/` | `bounds.*` |
| `@geokit/bearing` | `src/utils/bearing/` | `GeoKitCore/Utils/bearing/` | `bearing.*` |
| `@geokit/coordinates` | `src/utils/coordinates/` | `GeoKitCore/Utils/coordinates/` | `validation.*` |
| `@geokit/distance` | `src/utils/distance/` | `GeoKitCore/Utils/distance/` | `distance.*` |
| `@geokit/h3` | `src/utils/h3/` | `GeoKitCore/Utils/h3/` | `h3.*` |
| `@geokit/geohash` | `src/utils/geohash/` | `GeoKitCore/Utils/geohash/` | `geohash.*` |
| `@geokit/geojson` | `src/utils/geojson/` | `GeoKitCore/Utils/geojson/` | `geojson.*` |
| `@geokit/types` | `src/types/` | `GeoKitCore/Types/` | — |
| constants | `src/constants.ts` | `GeoKitCore/Constants/` | — |

## Turf (Tier 1.5)

| Node export | TS path | Swift path | Fixture |
|-------------|---------|------------|---------|
| `@geokit/turf` | `src/utils/turf/` | `GeoKitCore/Utils/{containment,centroid,area,length,buffer,conversions,turf}` | `turf.*` |

## Contract (Tier 2)

| Node export | TS path | Swift path |
|-------------|---------|------------|
| `@geokit/contract` | `src/contract/` | `GeoKitContract/` |
| `@geokit/ui/bootstrap/ensure-map-ready` | `src/ui/bootstrap/ensure-map-ready.ts` | `GeoKitUI/Bootstrap/` |
| lifecycle constants | `src/contract/lifecycle.ts` | `GeoKitContract/Lifecycle/` |
| `MapStaticProviderId` | `src/types/map-provider.ts` | `GeoKitContract/Providers/MapProviderId.swift` |

## UI & providers

| Node export | TS path | Swift path |
|-------------|---------|------------|
| `@geokit/ui` | `src/ui/` | `GeoKitUI/` |
| `@geokit/api` | `packages/api/` | — (registry, routing, plugin hooks) |
| `@geokit/plugin-*` | `packages/plugin-*/` | — (vendor API provider implementations) |
| Mapbox map surface | `src/ui/providers/mapbox-provider.ts` | `GeoKitUIMapbox/` |
| Apple Maps | — | `GeoKitUI/Providers/Apple/` |

Regenerate shared fixtures: `yarn export:parity-fixtures`  
Verify: `yarn check:parity-fixtures`

See also [standalone-kit.md](./standalone-kit.md) for minimal third-party boot.
