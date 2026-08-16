# Map provider alignment

Static and runtime map providers differ by platform but share the same **contract layer** role.

## Static snapshot providers

| | TypeScript | Swift |
|---|------------|-------|
| Type | `MapStaticProviderId` in `src/types/map-provider.ts` | `MapProviderId` in `GeoKitContract/Providers/` |
| Values | `maptiler` \| `mapbox` | `mapbox` \| `apple` |
| Registry | `src/api/registry`, env `GEOKIT_MAP_PROVIDER` | `GeoKitMapProviderRegistry` + `Info.plist` |

MapTiler is web/Node-only. Apple Maps is Swift-only via MapKit.

## Runtime map surfaces

| | TypeScript | Swift |
|---|------------|-------|
| Mapbox GL | `src/ui/providers/mapbox-provider.ts` | `GeoKitUIMapbox/` |
| Apple Maps | — | `GeoKitUI/Providers/Apple/` |
| Bootstrap | `ensureMapReady` (`@geokit/contract`) | `GeoKitMapBootstrap.prepareMapbox()` |

## Out of scope (both cores)

Globe CDN fetch, DMA JWT, H3 cell layer catalogs — **`@twinfile/globe-static`** (`host/client`, `host/map`).
