# UI providers (map backends)

Map rendering only. HTTP geocoding, isochrones, and place search use `@geokit/service` and `services/*` — see [architecture.md](architecture.md).

Swift mirror: [`geokit-swift/docs/providers.md`](../../geokit-swift/docs/providers.md).

## Platform matrix

| | TypeScript (`@geokit/core`) | Swift (`geokit-swift`) |
|---|------------------------------|-------------------------|
| Primary GL backend | MapTiler (`@maptiler/sdk`) | Mapbox (`MapboxMaps`) |
| Alternate backend | Mapbox GL JS | Apple MapKit |
| Static snapshot ids | `maptiler` \| `mapbox` | `mapbox` \| `apple` |
| Registry | `configureUIProviders`, `src/ui/providers/registry.ts` | `GeoKitMapProviderRegistry` |
| Env default | `GEOKIT_MAP_PROVIDER`, `MAP_PROVIDER` | same + `Info.plist` |
| Per-map override | `<gk-map provider="…">` | `MapContentRequest.mapProviderId` |

Default on web: **maptiler** (`src/config/index.ts`). Default on Swift: **mapbox**.

## Runtime surfaces

| Backend | TypeScript path | Swift |
|---------|-----------------|-------|
| MapTiler | `src/ui/providers/maptiler-provider.ts` | — |
| Mapbox GL | `src/ui/providers/mapbox-provider.ts` | `GeoKitUIMapbox/` |
| Apple Maps | — | `GeoKitUI/Providers/Apple/` |
| Bootstrap | `ensureMapReady` (`@geokit/core/contract`) | `GeoKitMapBootstrap.prepare()` |

## Choropleth fills

Semi-transparent polygon fills can show triangulation artifacts. Use `buildChoroplethFillPaint` from `@geokit/core/ui/choropleth-fill-paint` for fill layers on admin boundaries and regions.
