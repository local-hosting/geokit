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

## Import changes

| Before (still works, deprecated) | Preferred |
|---|---|
| `geokit/api` | `@geokit/api` |
| `geokit/api/place-taxonomy` | `@geokit/api/place-taxonomy` |
| `geokit/api/registry` | `@geokit/api/registry` |
| `geokit/api/providers/foursquare` | `@geokit/api/providers/foursquare` |
| `geokit/api/plugin` | `@geokit/api/plugin` |

Legacy `geokit/api/*` paths remain as thin re-exports for one major version but require `@geokit/api` to be installed.

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

None for imports in 0.3.x — shims preserve `geokit/api/*`. The breaking change is **install topology**: map UI features that call providers (`gk-isochrone`, geocoding helpers) need `@geokit/api` installed at runtime.

Future 1.0 may remove `geokit/api/*` re-exports entirely.
