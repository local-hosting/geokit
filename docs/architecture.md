# Architecture

Geokit uses **provider** in three layers. Each has its own registry — they are not interchangeable.

| Layer | Location | Role |
|-------|----------|------|
| **Service** | `@geokit/service` + `src/providers/*` | HTTP: place search, geocoding, isochrones, directions |
| **Plugin** | `GeokitServicePlugin` in each `src/providers/*` package | npm install boundary + `registerGeokitPlugin()` |
| **UI provider** | `@geokit/ui` (`src/providers/`) | Map rendering (MapTiler SDK, Mapbox GL JS) |

```text
@geokit/foursquare          ← service package
  └── GeokitServicePlugin
        └── FoursquareService
              └── registerService('foursquare', …)

MapboxUIProvider            ← separate UI registry (draws the map)
```

Say **service**, **plugin**, or **UI provider** — not bare "provider".

## Monorepo layout

| Package | Path |
|---------|------|
| `@geokit/env` | `src/env/` |
| `@geokit/h3` | `src/h3/` |
| `@geokit/core` | `src/core/` |
| `@geokit/ui` | `src/ui/` |
| `@geokit/service` | `src/service/` |
| `@geokit/crosswalk` | `src/crosswalk/` |
| `@geokit/foursquare`, `@geokit/google`, `@geokit/mapbox`, `@geokit/maptiler`, `@geokit/here`, `@geokit/osm`, `@geokit/esri` | `src/providers/*/` |

## Install

| Need | Packages |
|------|----------|
| Geo utils only | `@geokit/core` |
| Map UI | `@geokit/ui` |
| Place search / geocoding / isochrones | + `@geokit/service` |
| Vendor APIs | + one or more `src/providers/*` packages |

## Bootstrap

**`ensureCapabilityRoutersReady()`** (`@geokit/service/builtins`): registers MapTiler + Mapbox routing plugins when env keys are present (geocoding, isochrone, directions).

**`ensurePlaceSearchRouterReady()`**: loads Foursquare + Google place-search plugins on demand, then rebuilds routers.

**Capability-specific helpers**: `ensureGeocodingRouterReady()`, `ensureIsochroneRouterReady()`.

**Opt-in**: HERE, OSM, Esri — register explicitly.

```typescript
import {
  ensureCapabilityRoutersReady,
  ensurePlaceSearchRouterReady,
} from '@geokit/service/builtins';
import { registerOsmPlugin } from '@geokit/osm';

await ensureCapabilityRoutersReady();
await registerOsmPlugin();
await ensurePlaceSearchRouterReady();
```


## Same vendor, two jobs

| Concern | Import | Example |
|---------|--------|---------|
| Draw map | `@geokit/ui` | `MapboxUIProvider`, `<gk-map provider="mapbox">` |
| HTTP APIs | `@geokit/mapbox` | `MapboxService` (geocode, isochrone, directions) |

`<gk-isochrone>` uses the **service** registry (`getServiceForCapability('isochrone')`), not the UI provider registry.

## Authoring a service plugin

```typescript
import type { GeokitServicePlugin } from '@geokit/service/plugin';
import { Service } from '@geokit/service/types';
import { registerGeokitPlugin } from '@geokit/service/plugin';

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

- `@geokit/ui/vue`
- `@geokit/ui/react`
- `@geokit/ui/svelte`
- `@geokit/ui/adapters/shared`

Import vendor service classes from `src/providers/*` packages, not from `@geokit/service`.

## Import tiers (tree-shaking)

| Tier | Package / subpath | Pulls `h3-js`? |
|------|-------------------|----------------|
| Distance / bounds | `@geokit/core/distance`, `@geokit/core/bounds` | No |
| Spatial H3 decode | `@geokit/core/spatial/decode` | Yes (via `@geokit/h3`) |
| Env keys | `@geokit/env`, `@geokit/env/service-keys` | No |
| H3 lite | `@geokit/h3/lite` | No |
| H3 full | `@geokit/h3` | Yes (peer) |
| H3 (legacy) | `@geokit/core/h3` | Yes — deprecated re-export of `@geokit/h3` |
| UI map | `@geokit/ui`, `@geokit/ui/elements-lite` | Via optional chunks |
| Service builtins | `@geokit/service/builtins` | No (explicit import) |
| Crosswalk | `@geokit/crosswalk`, `@geokit/crosswalk/us` | Via `@geokit/h3` when H3 lookups used |

Run `yarn workspace @geokit/core bundle-smoke` (included in `test:all`) to guard distance-only bundles.
