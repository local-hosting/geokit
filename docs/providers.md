# Map provider alignment

Static and runtime map providers differ by platform but share the same **contract layer** role.

Swift mirror: [`geokit-swift/docs/providers.md`](../../geokit-swift/docs/providers.md).

## Platform matrix

| Role | TypeScript (`geokit`) | Swift (`geokit-swift`) |
|------|----------------------|-------------------------|
| Primary GL backend | **MapTiler** (`@maptiler/sdk`) | **Mapbox** (`MapboxMaps`) |
| Native / alternate backend | **Mapbox GL JS** | **Apple MapKit** |
| Static snapshot ids | `maptiler` \| `mapbox` | `mapbox` \| `apple` |
| Registry | `configureUIProviders`, `src/ui/providers/registry.ts` | `GeoKitMapProviderRegistry` |
| Env | `GEOKIT_MAP_PROVIDER`, `MAP_PROVIDER` | Same + `Info.plist` `GEOKIT_MAP_PROVIDER` |
| Per-map override | `<gk-map provider="…">` | `MapContentRequest.mapProviderId` |

MapTiler is web/Node-only. Apple Maps is Swift/iOS-only via MapKit.

## Runtime map surfaces

| | TypeScript | Swift |
|---|------------|-------|
| MapTiler | `src/ui/providers/maptiler-provider.ts` | — |
| Mapbox GL | `src/ui/providers/mapbox-provider.ts` | `GeoKitUIMapbox/` |
| Apple Maps | — | `GeoKitUI/Providers/Apple/` |
| Bootstrap | `ensureMapReady` (`@geokit/contract`) | `GeoKitMapBootstrap.prepare()` |

Default UI provider on web is **maptiler** (`src/config/index.ts`). Default on Swift is **mapbox** (`MapProviderResolver.fromEnvironment()`).

---

## Web parity checklist — MapTiler vs Mapbox

Legend: **✅** both providers · **🟡** partial / provider-specific config · **❌** not supported · **➖** N/A on web

### Map shell (`gk-map`, contract lifecycle)

| Feature | MapTiler | Mapbox | Notes |
|---------|----------|--------|-------|
| Live map (`createMap`) | ✅ | ✅ | `BaseUIProvider` |
| Theme / style switching | ✅ | ✅ | `getStyleForTheme()` per provider |
| Custom Studio style URL | ✅ | ✅ | MapTiler style names vs `mapbox://` URIs |
| Placeholder / snapshot / live phases | ✅ | ✅ | `@geokit/contract` + `ensureMapReady` |
| Provider attribute on element | ✅ | ✅ | `provider="maptiler\|mapbox"` |
| Env-based default provider | ✅ | ✅ | `GEOKIT_MAP_PROVIDER` |

### Map child components (via active `MapInstance`)

| Feature | MapTiler | Mapbox | Notes |
|---------|----------|--------|-------|
| `gk-point` / point layers | ✅ | ✅ | Primary dev path is MapTiler |
| `gk-polyline` | ✅ | ✅ | `lineMetrics` for gradients |
| `gk-polygon` | ✅ | ✅ | |
| `gk-layer` / datasets | ✅ | 🟡 | Test coverage heavier on MapTiler |
| `gk-isochrone` | ✅ | 🟡 | API default routes to MapTiler |
| `gk-h3` viewport grid | ✅ | 🟡 | Demos use MapTiler |
| Popups | ✅ | ✅ | |
| Controls (zoom, scale, fullscreen) | ✅ | ✅ | |
| Terrain / 3D buildings | 🟡 | 🟡 | Terrain source ids include `maptiler-terrain` |
| Route progress `line-gradient` | ✅ | ✅ | `buildRouteProgressGradient` (MapLibre expr) |
| Choropleth / admin outlines | ✅ | ✅ | Shared MapLibre paint helpers |

### Static snapshots (`geokit/static-map`)

| Feature | MapTiler | Mapbox | Notes |
|---------|----------|--------|-------|
| Point / bounds / auto fit | ✅ | ✅ | `src/static-map/providers/` |
| Overlays (paths, markers) | ✅ | ✅ | |

### API capabilities (separate from map GL provider)

| Capability | MapTiler | Mapbox | Notes |
|------------|----------|--------|-------|
| Isochrone | ✅ default | ✅ | `getProviderForCapability('isochrone')` |
| Geocoding | ✅ default | 🟡 | Registry fallback order |
| Directions | ✅ default | ✅ | `mapbox-provider` directions |
| Place search | ✅ | 🟡 | Foursquare / Google separate |

### Known web gaps (track here)

- [ ] Explicit Mapbox integration tests for each `gk-*` element (today demos skew MapTiler)
- [ ] Document style-name mapping when switching providers mid-app
- [ ] API capability fallbacks when only one token is configured
- [ ] Terrain/DEM parity when `provider="mapbox"`

---

## Out of scope (both cores)

Application data, auth, and integration tooling — host apps, not geokit cores.

Geo math (`interpolateAlongPath`, H3, distance, etc.) is provider-agnostic in `geokit` / `GeoKitCore`.
