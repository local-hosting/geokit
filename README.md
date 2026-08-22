# Geokit monorepo

Yarn workspaces monorepo for the geospatial SDK and POI taxonomy.

## Packages

| Package | Description |
|---|---|
| [`geokit`](packages/core/) | Core geo utilities, map UI, API providers |
| [`@geokit/geotypes`](packages/geotypes/) | POI taxonomy (YAML, proto, slugs, acronyms) |

## Commands

```bash
yarn install
yarn build          # build geokit core
yarn test           # core + geotypes tests
yarn workspace geokit run dev
yarn workspace @geokit/geotypes run sync   # slugs + acronyms + provider tables
yarn workspace @geokit/geotypes run open   # Clay taxonomy preview
```

See [packages/core/README.md](packages/core/README.md) for full geokit API documentation.

## Place taxonomy (Phase 2)

```typescript
import { setPlaceTaxonomyResolver } from 'geokit/api/place-taxonomy';
import { createGeokitTaxonomyResolver } from '@geokit/geotypes/geokit';

setPlaceTaxonomyResolver(createGeokitTaxonomyResolver());

// placeSearch({ geotypes: ['RSE'], ll: [...] }) → Foursquare/Google category params
```
