# Geokit API plugins

> **Plugins wrap API providers.** A plugin (`GeokitAPIPlugin`) registers a `BaseAPIProvider` into `@geokit/api/registry`. UI map backends are a separate layer — see [architecture-providers.md](architecture-providers.md).

Optional plugin packages extend `@geokit/api` without bloating the core `geokit` install.

## Package shape

| Package | Role |
|---|---|
| `@geokit/api` | API registry, composite routers, `registerGeokitPlugin()` (no vendor classes) |
| `@geokit/plugin-foursquare` | Foursquare Places search |
| `@geokit/plugin-google` | Google Places search |
| `@geokit/plugin-mapbox` | Mapbox geocoding, isochrone, directions |
| `@geokit/plugin-maptiler` | MapTiler geocoding |
| `@geokit/plugin-here` | HERE Places discover search |
| `@geokit/plugin-osm` | OpenStreetMap Overpass place search (no API key) |
| `@geokit/plugin-esri` | Esri ArcGIS Places near-point search |
| `@geokit/geotypes` | Taxonomy resolver (`RSE` → vendor category ids/tags) |

## Quick start

```typescript
import { ensurePlaceSearchRouterReady } from '@geokit/api';
import { setPlaceTaxonomyResolver } from '@geokit/api/place-taxonomy';
import { createGeokitTaxonomyResolver } from '@geokit/geotypes/geokit';
import { registerFoursquarePlugin } from '@geokit/plugin-foursquare';
import { registerGooglePlacesPlugin } from '@geokit/plugin-google';
import { registerOsmPlugin } from '@geokit/plugin-osm';
import { registerEsriPlacesPlugin } from '@geokit/plugin-esri';

setPlaceTaxonomyResolver(createGeokitTaxonomyResolver());
await registerFoursquarePlugin();
await registerGooglePlacesPlugin();
await registerOsmPlugin();
await ensurePlaceSearchRouterReady();

// Foursquare → Google → OSM fallback chain (based on env keys + registered plugins)
const router = await ensurePlaceSearchRouterReady();
```

Search by geotype acronym:

```typescript
import { getCapabilityRouter } from '@geokit/api/registry';

const placeSearch = getCapabilityRouter('placeSearch');
const results = await placeSearch?.placeSearch?.({
  ll: [-86.78, 36.16],
  geotypes: ['RSE'],
  radius: 1500,
});
```

## Authoring a plugin

Implement `GeokitAPIPlugin`:

```typescript
import type { GeokitAPIPlugin } from '@geokit/api/plugin';
import { BaseAPIProvider } from '@geokit/api/types';

class HerePlacesProvider extends BaseAPIProvider {
  getName() {
    return 'here-places';
  }
  getCapabilities() {
    return ['placeSearch'] as const;
  }
  async initialize(_config) {}
  async placeSearch(options) {
    // resolvePlaceSearchCategories(options, 'here-places')
    return [];
  }
}

export const herePlacesPlugin: GeokitAPIPlugin = {
  name: 'here-places',
  capabilities: ['placeSearch'],
  createProvider: () => new HerePlacesProvider(),
  chain: { placeSearch: 'append' }, // or 'prepend'
};
```

Register at app bootstrap:

```typescript
import { registerGeokitPlugin } from '@geokit/api/plugin';

await registerGeokitPlugin(herePlacesPlugin, { apiKey: process.env.HERE_API_KEY });
```

Capability chains rebuild automatically when plugins register or unregister.

## Taxonomy

Geotypes maps canonical slugs/acronyms to vendor-specific categories:

| Provider | Example mapping for `electronics_store` / `RSE` |
|---|---|
| Foursquare | category id `4bf58dd8d48988d122951735` |
| Google Places | type `electronics_store` |
| HERE | code `ELECTRONICS_STORE` |
| OSM | tag `shop=electronics` |

Use `setPlaceTaxonomyResolver(createGeokitTaxonomyResolver())` before place search with `geotypes`.

## Reference: `@geokit/plugin-osm`

- Capability: `placeSearch`
- API: [Overpass API](https://wiki.openstreetmap.org/wiki/Overpass_API) (no API key required)
- Config: `{ overpassUrl?: string }` (default `https://overpass-api.de/api/interpreter`)
- Requires `ll` + `geotypes` or `categories` with OSM tag mappings

Default bootstrap (`registerDefaultPlugins`) registers Foursquare, Google, Mapbox, and MapTiler from their `@geokit/plugin-*` packages when env keys are present. HERE, OSM, and Esri are opt-in.

## Default plugin bundle

`@geokit/api/builtins` registers MapTiler, Mapbox, Foursquare, and Google when env keys are present:

```typescript
import { ensureCapabilityRoutersReady } from '@geokit/api/builtins';
await ensureCapabilityRoutersReady();
```

Opt-in plugins (HERE, OSM) register separately via `registerGeokitPlugin()` or their package helper.


## HERE plugin

```typescript
import { registerHerePlacesPlugin } from '@geokit/plugin-here';
import { rebuildCapabilityRouters } from '@geokit/api';

await registerHerePlacesPlugin();
await rebuildCapabilityRouters();
```

Set `HERE_API_KEY` or `GEOKIT_HERE_API_KEY`.


## Opt-in: `@geokit/plugin-esri`

Esri ArcGIS Places near-point search. Requires an Esri API key (`ESRI_API_KEY` or `GEOKIT_ESRI_API_KEY`).

```typescript
import { registerEsriPlacesPlugin } from '@geokit/plugin-esri';
import { rebuildCapabilityRouters } from '@geokit/api';

await registerEsriPlacesPlugin();
await rebuildCapabilityRouters();
```
