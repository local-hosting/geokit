# Providers, plugins, and map backends

Geokit uses **provider** in three related layers. They are not competing systems — each layer has its own registry and base class.

## Three layers

| Layer | Package / path | Base type | Registry | What it does |
|-------|----------------|-----------|----------|--------------|
| **API provider** | `@geokit/api` + `@geokit/plugin-*` | `BaseAPIProvider` | `@geokit/api/registry` | HTTP services: place search, geocoding, isochrones, directions |
| **Plugin** | `@geokit/plugin-*` npm packages | `GeokitAPIPlugin` | `@geokit/api/plugin` | Install boundary + registration metadata around an API provider |
| **UI provider** (map backend) | `geokit` → `src/ui/providers/` | `BaseUIProvider` | `configureUIProviders` / `src/ui/providers/registry.ts` | Map rendering: MapTiler SDK, Mapbox GL JS |

```text
@geokit/plugin-foursquare          ← plugin package (install + register)
  └── GeokitAPIPlugin              ← name, capabilities, chain position
        └── FoursquareAPIProvider  ← API provider (HTTP implementation)
              └── registerAPIProvider('foursquare', …)
                    └── getProviderForCapability('placeSearch')

geokit MapboxUIProvider            ← UI provider (separate registry)
  └── draws the map in the browser
```

**Rule of thumb:** say **API provider**, **plugin**, or **UI provider** — not bare "provider".

## API provider vs plugin

A **plugin** wraps an **API provider**:

- `GeokitAPIPlugin.createProvider()` builds the `BaseAPIProvider` instance
- `registerGeokitPlugin()` calls `registerAPIProvider()` and wires composite fallback chains
- Plugins declare `chain: { placeSearch: 'prepend' }` for fallback order

You can register a custom API provider directly with `registerAPIProvider()` (no plugin package), but published vendor integrations ship as `@geokit/plugin-*`.

## UI provider vs API provider (same vendor, different job)

Mapbox is the common source of confusion:

| Concern | Import from | Class |
|---------|-------------|-------|
| Draw map tiles, markers, layers | `geokit` UI | `MapboxUIProvider` |
| Isochrone / geocode / directions HTTP | `@geokit/plugin-mapbox` | `MapboxAPIProvider` |

MapTiler follows the same split: `MapTilerUIProvider` (map) vs `MapTilerAPIProvider` (geocoding API).

`<gk-isochrone>` uses the **API** registry (`getProviderForCapability('isochrone')`), not the UI provider registry.

## Install and bootstrap

| Need | Install |
|------|---------|
| Map UI only | `geokit` |
| API registry + composite routing | `@geokit/api` |
| Vendor HTTP integrations | `@geokit/plugin-*` (one per vendor) |
| POI taxonomy (`geotypes: ['RSE']`) | `@geokit/geotypes` |

**Default builtins** (`@geokit/api/builtins`): MapTiler, Mapbox, Foursquare, Google — when env keys are present.

**Opt-in plugins**: HERE, OSM, Esri — register explicitly at app bootstrap.

```typescript
import { ensureCapabilityRoutersReady, ensurePlaceSearchRouterReady } from '@geokit/api/builtins';
import { registerOsmPlugin } from '@geokit/plugin-osm';

await ensureCapabilityRoutersReady();
await registerOsmPlugin();
await ensurePlaceSearchRouterReady();
```

## Import cheat sheet

| Goal | Import |
|------|--------|
| Registry, routing, shared utils | `@geokit/api`, `@geokit/api/registry` |
| Register a plugin | `@geokit/api/plugin` |
| Bootstrap defaults | `@geokit/api/builtins` |
| Vendor API provider class | `@geokit/plugin-mapbox`, `@geokit/plugin-foursquare`, … |
| Configure map backend | `geokit` → `configureUIProviders`, `<gk-map provider="maptiler">` |

Do **not** import vendor API classes from `@geokit/api` — import from the plugin package.

## Related docs

- [plugins.md](plugins.md) — authoring and registering plugins
- [providers.md](providers.md) — UI map backends (MapTiler / Mapbox / Apple parity)
- [migration-api.md](migration-api.md) — import migration from legacy `geokit/api/*`
