# UI providers (map backends)

Map rendering only. HTTP geocoding, isochrones, and place search use `@local-hosting/geokit/service` and `src/providers/*` — see [architecture.md](architecture.md).

Swift mirror: [`geokit-swift/docs/providers.md`](../../geokit-swift/docs/providers.md).

## Platform matrix

| | TypeScript (`@local-hosting/geokit/ui`) | Swift (`geokit-swift`) |
|---|---------------------------|-------------------------|
| Primary GL backend | MapTiler (`@maptiler/sdk`) | Mapbox (`MapboxMaps`) |
| Alternate backend | Mapbox GL JS, Protomaps (`maplibre-gl`) | Apple MapKit |
| Static snapshot ids | `maptiler` \| `mapbox` | `mapbox` \| `apple` |
| Registry | `configure()`, `src/ui/src/providers/registry.ts` | `GeoKitMapProviderRegistry` |
| Env default | `GEOKIT_MAP_PROVIDER`, `MAP_PROVIDER` (`@local-hosting/geokit/env`) | same + `Info.plist` |
| Per-map override | `<gk-map provider="…">` | `MapContentRequest.mapProviderId` |

Default on web: **maptiler** (`resolveMapProviderIdFromEnv` in `@local-hosting/geokit/env`). Default on Swift: **mapbox**.

## Protomaps

Interactive basemap on web. Static snapshots stay `maptiler` or `mapbox`.

```html
<gk-map provider="protomaps" api-key="YOUR_KEY" lat="40.71" lng="-74.01" zoom="11"></gk-map>
```

```typescript
configure({ protomaps: { apiKey: 'YOUR_KEY' } });
ensureMapReady({ provider: 'protomaps', protomaps: { apiKey: 'YOUR_KEY' } });
```

Hosted styles come from `https://api.protomaps.com/styles/v5/{flavor}/{lang}.json`. Theme names `dataviz` and `dataviz-dark` map to the `white` and `black` flavors. A self-hosted archive uses `pmtilesUrl` (or the `pmtiles-url` attribute) and the `pmtiles://` protocol.

Env: `GEOKIT_MAP_PROVIDER=protomaps` and `PROTOMAPS_KEY` (alias `GEOKIT_PROTOMAPS_KEY`). When that key is the only map key present, provider resolution selects `protomaps`.

## Runtime surfaces

| Backend | TypeScript path | Swift |
|---------|-----------------|-------|
| MapTiler | `src/ui/src/providers/maptiler-provider.ts` | — |
| Mapbox GL | `src/ui/src/providers/mapbox-provider.ts` | `GeoKitUIMapbox/` |
| Protomaps | `src/ui/src/providers/protomaps-provider.ts` | — |
| Apple Maps | — | `GeoKitUI/Providers/Apple/` |
| Bootstrap | `ensureMapReady` (`@local-hosting/geokit/ui/bootstrap/ensure-map-ready`) | `GeoKitMapBootstrap.prepare()` |

## Choropleth fills

Semi-transparent polygon fills can show triangulation artifacts. Use `buildChoroplethFillPaint` from `@local-hosting/geokit/ui/choropleth-fill-paint` for fill layers on admin boundaries and regions.
