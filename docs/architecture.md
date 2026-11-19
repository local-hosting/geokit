# Architecture

Geokit uses **provider** in three layers. Each has its own registry — they are not interchangeable.

| Layer | Location | Role |
|-------|----------|------|
| **Service** | `@local-hosting/geokit/service` + `src/providers/*` | HTTP: place search, geocoding, isochrones, directions |
| **Plugin** | `GeokitServicePlugin` in each `src/providers/*` package | npm install boundary + `registerGeokitPlugin()` |
| **UI provider** | `@local-hosting/geokit/ui` (`src/providers/`) | Map rendering (MapTiler SDK, Mapbox GL JS) |

```text
@local-hosting/geokit/foursquare          ← service package
  └── GeokitServicePlugin
        └── FoursquareService
              └── registerService('foursquare', …)

MapboxUIProvider            ← separate UI registry (draws the map)
```

Say **service**, **plugin**, or **UI provider** — not bare "provider".

## Monorepo layout

| Package | Path |
|---------|------|
| `@local-hosting/geokit/env` | `src/env/` |
| `@local-hosting/geokit/h3` | `src/h3/` |
| `@local-hosting/geokit/core` | `src/core/` |
| `@local-hosting/geokit/ui` | `src/ui/` |
| `@local-hosting/geokit/service` | `src/service/` |
| `@local-hosting/geokit/crosswalk` | `src/crosswalk/` |
| `@local-hosting/geokit/foursquare`, `@local-hosting/geokit/google`, `@local-hosting/geokit/mapbox`, `@local-hosting/geokit/maptiler`, `@local-hosting/geokit/here`, `@local-hosting/geokit/osm`, `@local-hosting/geokit/esri` | `src/providers/*/` |

## Install

| Need | Packages |
|------|----------|
| Geo utils only | `@local-hosting/geokit/core` |
| Map UI | `@local-hosting/geokit/ui` |
| Place search / geocoding / isochrones | + `@local-hosting/geokit/service` |
| Vendor APIs | + one or more `src/providers/*` packages |

## Bootstrap

**`ensureCapabilityRoutersReady()`** (`@local-hosting/geokit/service/builtins`): registers MapTiler + Mapbox routing plugins when env keys are present (geocoding, isochrone, directions).

**`ensurePlaceSearchRouterReady()`**: loads Foursquare + Google place-search plugins on demand, then rebuilds routers.

**Capability-specific helpers**: `ensureGeocodingRouterReady()`, `ensureIsochroneRouterReady()`.

**Opt-in**: HERE, OSM, Esri — register explicitly.

```typescript
import {
  ensureCapabilityRoutersReady,
  ensurePlaceSearchRouterReady,
} from '@local-hosting/geokit/service/builtins';
import { registerOsmPlugin } from '@local-hosting/geokit-osm';

await ensureCapabilityRoutersReady();
await registerOsmPlugin();
await ensurePlaceSearchRouterReady();
```


## Same vendor, two jobs

| Concern | Import | Example |
|---------|--------|---------|
| Draw map | `@local-hosting/geokit/ui` | `MapboxUIProvider`, `<gk-map provider="mapbox">` |
| HTTP APIs | `@local-hosting/geokit/mapbox` | `MapboxService` (geocode, isochrone, directions) |

`<gk-isochrone>` uses the **service** registry (`getServiceForCapability('isochrone')`), not the UI provider registry.

## Authoring a service plugin

```typescript
import type { GeokitServicePlugin } from '@local-hosting/geokit/service/plugin';
import { Service } from '@local-hosting/geokit/service/types';
import { registerGeokitPlugin } from '@local-hosting/geokit/service/plugin';

class HerePlacesProvider extends Service {
  getName() { return 'here-places'; }
  getCapabilities() { return ['placeSearch'] as const; }
  async initialize() {}
  async placeSearch() { return []; }
}

export const herePlacesPlugin: GeokitServicePlugin = {
  name: 'here-places',
  capabilities: ['placeSearch'],
  createProvider: () => new HerePlacesProvider(),
  chain: { placeSearch: 'append' },
};

await registerGeokitPlugin(herePlacesPlugin, { apiKey: process.env.HERE_API_KEY });
```

## Framework adapters

Thin lifecycle glue over Web Components — optional peer deps per framework:

- `@local-hosting/geokit/ui/vue`
- `@local-hosting/geokit/ui/react`
- `@local-hosting/geokit/ui/svelte`
- `@local-hosting/geokit/ui/adapters/shared`

Import vendor service classes from `src/providers/*` packages, not from `@local-hosting/geokit/service`.

## Import tiers (tree-shaking)

| Tier | Package / subpath | Pulls `h3-js`? |
|------|-------------------|----------------|
| Distance / bounds | `@local-hosting/geokit/core/distance`, `@local-hosting/geokit/core/bounds` | No |
| Spatial H3 decode | `@local-hosting/geokit/core/spatial/decode` | Yes (via `@local-hosting/geokit/h3`) |
| Env keys | `@local-hosting/geokit/env`, `@local-hosting/geokit/env/service-keys` | No |
| H3 lite | `@local-hosting/geokit/h3/lite` | No |
| H3 full | `@local-hosting/geokit/h3` | Yes (peer) |
| H3 (legacy) | `@local-hosting/geokit/core/h3` | Yes — deprecated re-export of `@local-hosting/geokit/h3` |
| UI map | `@local-hosting/geokit/ui`, `@local-hosting/geokit/ui/elements-lite` | Via optional chunks |
| Service builtins | `@local-hosting/geokit/service/builtins` | No (explicit import) |
| Crosswalk | `@local-hosting/geokit/crosswalk`, `@local-hosting/geokit/crosswalk/us` | Via `@local-hosting/geokit/h3` when H3 lookups used |

Run `yarn workspace @local-hosting/geokit/core bundle-smoke` (included in `test:all`) to guard distance-only bundles.
