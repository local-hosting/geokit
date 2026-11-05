# Architecture

Geokit uses **provider** in three layers. Each has its own registry — they are not interchangeable.

| Layer | Location | Role |
|-------|----------|------|
| **Service** | `@twinfile/geokit/service` + `src/providers/*` | HTTP: place search, geocoding, isochrones, directions |
| **Plugin** | `GeokitServicePlugin` in each `src/providers/*` package | npm install boundary + `registerGeokitPlugin()` |
| **UI provider** | `@twinfile/geokit/ui` (`src/providers/`) | Map rendering (MapTiler SDK, Mapbox GL JS) |

```text
@twinfile/geokit/foursquare          ← service package
  └── GeokitServicePlugin
        └── FoursquareService
              └── registerService('foursquare', …)

MapboxUIProvider            ← separate UI registry (draws the map)
```

Say **service**, **plugin**, or **UI provider** — not bare "provider".

## Monorepo layout

| Package | Path |
|---------|------|
| `@twinfile/geokit/env` | `src/env/` |
| `@twinfile/geokit/h3` | `src/h3/` |
| `@twinfile/geokit/core` | `src/core/` |
| `@twinfile/geokit/ui` | `src/ui/` |
| `@twinfile/geokit/service` | `src/service/` |
| `@twinfile/geokit/crosswalk` | `src/crosswalk/` |
| `@twinfile/geokit/foursquare`, `@twinfile/geokit/google`, `@twinfile/geokit/mapbox`, `@twinfile/geokit/maptiler`, `@twinfile/geokit/here`, `@twinfile/geokit/osm`, `@twinfile/geokit/esri` | `src/providers/*/` |

## Install

| Need | Packages |
|------|----------|
| Geo utils only | `@twinfile/geokit/core` |
| Map UI | `@twinfile/geokit/ui` |
| Place search / geocoding / isochrones | + `@twinfile/geokit/service` |
| Vendor APIs | + one or more `src/providers/*` packages |

## Bootstrap

**`ensureCapabilityRoutersReady()`** (`@twinfile/geokit/service/builtins`): registers MapTiler + Mapbox routing plugins when env keys are present (geocoding, isochrone, directions).

**`ensurePlaceSearchRouterReady()`**: loads Foursquare + Google place-search plugins on demand, then rebuilds routers.

**Capability-specific helpers**: `ensureGeocodingRouterReady()`, `ensureIsochroneRouterReady()`.

**Opt-in**: HERE, OSM, Esri — register explicitly.

```typescript
import {
  ensureCapabilityRoutersReady,
  ensurePlaceSearchRouterReady,
} from '@twinfile/geokit/service/builtins';
import { registerOsmPlugin } from '@twinfile/geokit-osm';

await ensureCapabilityRoutersReady();
await registerOsmPlugin();
await ensurePlaceSearchRouterReady();
```


## Same vendor, two jobs

| Concern | Import | Example |
|---------|--------|---------|
| Draw map | `@twinfile/geokit/ui` | `MapboxUIProvider`, `<gk-map provider="mapbox">` |
| HTTP APIs | `@twinfile/geokit/mapbox` | `MapboxService` (geocode, isochrone, directions) |

`<gk-isochrone>` uses the **service** registry (`getServiceForCapability('isochrone')`), not the UI provider registry.

## Authoring a service plugin

```typescript
import type { GeokitServicePlugin } from '@twinfile/geokit/service/plugin';
import { Service } from '@twinfile/geokit/service/types';
import { registerGeokitPlugin } from '@twinfile/geokit/service/plugin';

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

- `@twinfile/geokit/ui/vue`
- `@twinfile/geokit/ui/react`
- `@twinfile/geokit/ui/svelte`
- `@twinfile/geokit/ui/adapters/shared`

Import vendor service classes from `src/providers/*` packages, not from `@twinfile/geokit/service`.

## Import tiers (tree-shaking)

| Tier | Package / subpath | Pulls `h3-js`? |
|------|-------------------|----------------|
| Distance / bounds | `@twinfile/geokit/core/distance`, `@twinfile/geokit/core/bounds` | No |
| Spatial H3 decode | `@twinfile/geokit/core/spatial/decode` | Yes (via `@twinfile/geokit/h3`) |
| Env keys | `@twinfile/geokit/env`, `@twinfile/geokit/env/service-keys` | No |
| H3 lite | `@twinfile/geokit/h3/lite` | No |
| H3 full | `@twinfile/geokit/h3` | Yes (peer) |
| H3 (legacy) | `@twinfile/geokit/core/h3` | Yes — deprecated re-export of `@twinfile/geokit/h3` |
| UI map | `@twinfile/geokit/ui`, `@twinfile/geokit/ui/elements-lite` | Via optional chunks |
| Service builtins | `@twinfile/geokit/service/builtins` | No (explicit import) |
| Crosswalk | `@twinfile/geokit/crosswalk`, `@twinfile/geokit/crosswalk/us` | Via `@twinfile/geokit/h3` when H3 lookups used |

Run `yarn workspace @twinfile/geokit/core bundle-smoke` (included in `test:all`) to guard distance-only bundles.
