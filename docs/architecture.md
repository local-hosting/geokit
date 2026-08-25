# Architecture

Geokit uses **provider** in three layers. Each has its own registry — they are not interchangeable.

| Layer | Location | Role |
|-------|----------|------|
| **Service** | `@geokit/service` + `services/*` | HTTP: place search, geocoding, isochrones, directions |
| **Plugin** | `GeokitServicePlugin` in each `services/*` package | npm install boundary + `registerGeokitPlugin()` |
| **UI provider** | `@geokit/core` → `src/ui/providers/` | Map rendering (MapTiler SDK, Mapbox GL JS) |

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
| `@geokit/core` | `packages/core/` |
| `@geokit/service` | `packages/service/` |
| `@geokit/geotypes` | `packages/geotypes/` |
| `@geokit/crosswalk` | `packages/crosswalk/` |
| `@geokit/foursquare`, `@geokit/google`, `@geokit/mapbox`, `@geokit/maptiler`, `@geokit/here`, `@geokit/osm`, `@geokit/esri` | `services/*/` |

## Install

| Need | Packages |
|------|----------|
| Geo utils + map UI | `@geokit/core` |
| Place search / geocoding / isochrones | + `@geokit/service` |
| POI taxonomy (`geotypes: ['RSE']`) | + `@geokit/geotypes` |
| Vendor APIs | + one or more `services/*` packages |

## Bootstrap

**Defaults** (`@geokit/service/builtins`): MapTiler, Mapbox, Foursquare, Google when env keys are present.

**Opt-in**: HERE, OSM, Esri — register explicitly.

```typescript
import { ensureCapabilityRoutersReady, ensurePlaceSearchRouterReady } from '@geokit/service/builtins';
import { setPlaceTaxonomyResolver } from '@geokit/service/place-taxonomy';
import { createGeokitTaxonomyResolver } from '@geokit/geotypes/geokit';
import { registerOsmPlugin } from '@geokit/osm';

setPlaceTaxonomyResolver(createGeokitTaxonomyResolver());
await ensureCapabilityRoutersReady();
await registerOsmPlugin();
await ensurePlaceSearchRouterReady();
```

Search by geotype:

```typescript
import { getCapabilityRouter } from '@geokit/service/registry';

const placeSearch = getCapabilityRouter('placeSearch');
await placeSearch?.placeSearch?.({
  ll: [-86.78, 36.16],
  geotypes: ['RSE'],
  radius: 1500,
});
```

## Same vendor, two jobs

| Concern | Import | Example |
|---------|--------|---------|
| Draw map | `@geokit/core` UI | `MapboxUIProvider`, `<gk-map provider="mapbox">` |
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

- `@geokit/core/vue`
- `@geokit/core/react`
- `@geokit/core/svelte`
- `@geokit/core/adapters/shared`

## Import migration

Legacy `geokit/api/*` re-exports are removed. Use:

| Before | After |
|--------|-------|
| `geokit/api` | `@geokit/service` |
| `geokit/api/registry` | `@geokit/service/registry` |
| `geokit/api/plugin` | `@geokit/service/plugin` |
| `geokit/api/providers/foursquare` | `@geokit/foursquare` |

Do not import vendor service classes from `@geokit/service` — import from the `services/*` package.
