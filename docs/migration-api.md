# Migrating to `@geokit/api`

Geokit **0.3+** publishes API providers from `@geokit/api` instead of bundling them in the core `geokit` package.

## Install patterns

**Geo utilities only (slim):**

```bash
yarn add geokit
```

**Full stack (place search, geocoding, isochrones):**

```bash
yarn add geokit @geokit/api
```

**With POI taxonomy:**

```bash
yarn add geokit @geokit/api @geokit/geotypes
```

**Optional OSM fallback:**

```bash
yarn add @geokit/plugin-osm
```

See [architecture-providers.md](architecture-providers.md) for API provider vs plugin vs UI provider terminology.

## Import changes

| Before (removed) | Preferred |
|---|---|
| `geokit/api` | `@geokit/api` |
| `geokit/api/place-taxonomy` | `@geokit/api/place-taxonomy` |
| `geokit/api/registry` | `@geokit/api/registry` |
| `geokit/api/providers/foursquare` | `@geokit/plugin-foursquare` |
| `geokit/api/plugin` | `@geokit/api/plugin` |
| `geokit/api/setup-capability-routers` | `@geokit/api/setup-capability-routers` |
| `geokit/api/types` | `@geokit/api/types` |


## Bootstrap example

```typescript
import { ensurePlaceSearchRouterReady } from '@geokit/api';
import { setPlaceTaxonomyResolver } from '@geokit/api/place-taxonomy';
import { createGeokitTaxonomyResolver } from '@geokit/geotypes/geokit';
import { registerOsmPlugin } from '@geokit/plugin-osm';

setPlaceTaxonomyResolver(createGeokitTaxonomyResolver());
await registerOsmPlugin();
await ensurePlaceSearchRouterReady();
```

## Monorepo consumers

```json
{
  "dependencies": {
    "geokit": "workspace:*",
    "@geokit/api": "workspace:*",
    "@geokit/geotypes": "workspace:*"
  }
}
```

## Breaking changes

**0.3.x breaking:** `geokit/api/*` re-exports are removed. Import from `@geokit/api` and `@geokit/plugin-*` directly. Map UI features that call providers (`gk-isochrone`, geocoding helpers) still need `@geokit/api` (and relevant plugins) installed at runtime.
