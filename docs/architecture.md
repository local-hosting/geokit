# Architecture

Geokit uses **provider** in three layers. Each has its own registry — they are not interchangeable.

| Layer | Location | Role |
|-------|----------|------|
| **Service** | `@doppler-group/geokit/service` + `src/providers/*` | HTTP: place search, geocoding, isochrones, directions |
| **Plugin** | `GeokitServicePlugin` in each `src/providers/*` package | npm install boundary + `registerGeokitPlugin()` |
| **UI provider** | `@doppler-group/geokit/ui` (`src/providers/`) | Map rendering (MapTiler SDK, Mapbox GL JS) |

```text
@doppler-group/geokit/foursquare          ← service package
  └── GeokitServicePlugin
        └── FoursquareService
              └── registerService('foursquare', …)

MapboxUIProvider            ← separate UI registry (draws the map)
```

Say **service**, **plugin**, or **UI provider** — not bare "provider".

## Monorepo layout

| Package | Path |
|---------|------|
| `@doppler-group/geokit/env` | `src/env/` |
| `@doppler-group/geokit/h3` | `src/h3/` |
| `@doppler-group/geokit/core` | `src/core/` |
| `@doppler-group/geokit/ui` | `src/ui/` |
| `@doppler-group/geokit/service` | `src/service/` |
| `@doppler-group/geokit/crosswalk` | `src/crosswalk/` |
| `@doppler-group/geokit/foursquare`, `@doppler-group/geokit/google`, `@doppler-group/geokit/mapbox`, `@doppler-group/geokit/maptiler`, `@doppler-group/geokit/here`, `@doppler-group/geokit/osm`, `@doppler-group/geokit/esri` | `src/providers/*/` |

## Install

| Need | Packages |
|------|----------|
| Geo utils only | `@doppler-group/geokit/core` |
| Map UI | `@doppler-group/geokit/ui` |
| Place search / geocoding / isochrones | + `@doppler-group/geokit/service` |
| Vendor APIs | + one or more `src/providers/*` packages |

## Bootstrap

**`ensureCapabilityRoutersReady()`** (`@doppler-group/geokit/service/builtins`): registers MapTiler + Mapbox routing plugins when env keys are present (geocoding, isochrone, directions).

**`ensurePlaceSearchRouterReady()`**: loads Foursquare + Google place-search plugins on demand, then rebuilds routers.

**Capability-specific helpers**: `ensureGeocodingRouterReady()`, `ensureIsochroneRouterReady()`.

**Opt-in**: HERE, OSM, Esri — register explicitly.

```typescript
import {
  ensureCapabilityRoutersReady,
  ensurePlaceSearchRouterReady,
} from '@doppler-group/geokit/service/builtins';
import { registerOsmPlugin } from '@doppler-group/geokit-osm';

await ensureCapabilityRoutersReady();
await registerOsmPlugin();
await ensurePlaceSearchRouterReady();
```


## Same vendor, two jobs

| Concern | Import | Example |
|---------|--------|---------|
| Draw map | `@doppler-group/geokit/ui` | `MapboxUIProvider`, `<gk-map provider="mapbox">` |
| HTTP APIs | `@doppler-group/geokit/mapbox` | `MapboxService` (geocode, isochrone, directions) |

`<gk-isochrone>` uses the **service** registry (`getServiceForCapability('isochrone')`), not the UI provider registry.

## Authoring a service plugin

```typescript
import type { GeokitServicePlugin } from '@doppler-group/geokit/service/plugin';
import { Service } from '@doppler-group/geokit/service/types';
import { registerGeokitPlugin } from '@doppler-group/geokit/service/plugin';

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

- `@doppler-group/geokit/ui/vue`
- `@doppler-group/geokit/ui/react`
- `@doppler-group/geokit/ui/svelte`
- `@doppler-group/geokit/ui/adapters/shared`

Import vendor service classes from `src/providers/*` packages, not from `@doppler-group/geokit/service`.

## Import tiers (tree-shaking)

| Tier | Package / subpath | Pulls `h3-js`? |
|------|-------------------|----------------|
| Distance / bounds | `@doppler-group/geokit/core/distance`, `@doppler-group/geokit/core/bounds` | No |
| Spatial H3 decode | `@doppler-group/geokit/core/spatial/decode` | Yes (via `@doppler-group/geokit/h3`) |
| Env keys | `@doppler-group/geokit/env`, `@doppler-group/geokit/env/service-keys` | No |
| H3 lite | `@doppler-group/geokit/h3/lite` | No |
| H3 full | `@doppler-group/geokit/h3` | Yes (peer) |
| H3 (legacy) | `@doppler-group/geokit/core/h3` | Yes — deprecated re-export of `@doppler-group/geokit/h3` |
| UI map | `@doppler-group/geokit/ui`, `@doppler-group/geokit/ui/elements-lite` | Via optional chunks |
| Service builtins | `@doppler-group/geokit/service/builtins` | No (explicit import) |
| Crosswalk | `@doppler-group/geokit/crosswalk`, `@doppler-group/geokit/crosswalk/us` | Via `@doppler-group/geokit/h3` when H3 lookups used |

Run `yarn workspace @doppler-group/geokit/core bundle-smoke` (included in `test:all`) to guard distance-only bundles.
