# Geokit monorepo

Yarn workspaces monorepo for the geospatial SDK and POI taxonomy.

## Packages

| Package | Description |
|---|---|
| [`geokit`](packages/core/) | Core geo utilities and map UI |
| [`@geokit/api`](packages/api/) | Place search providers, composite routing, taxonomy hooks |
| [`@geokit/geotypes`](packages/geotypes/) | POI taxonomy (YAML, proto, slugs, acronyms) |

## Commands

```bash
yarn install
yarn build          # build geokit core
yarn test           # core + api + geotypes tests
yarn typecheck      # all packages
yarn workspace geokit run dev
yarn workspace @geokit/geotypes run sync   # slugs + acronyms + provider tables
yarn workspace @geokit/geotypes run open   # Clay taxonomy preview
```

See [packages/core/README.md](packages/core/README.md) for full geokit API documentation.

## Place taxonomy

```typescript
import { setPlaceTaxonomyResolver } from '@geokit/api/place-taxonomy';
import { createGeokitTaxonomyResolver } from '@geokit/geotypes/geokit';

setPlaceTaxonomyResolver(createGeokitTaxonomyResolver());

// placeSearch({ geotypes: ['RSE'], ll: [...] }) → Foursquare/Google category params
```

Legacy `geokit/api/*` import paths still re-export `@geokit/api` for backward compatibility.
