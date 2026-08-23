# Geokit monorepo

Yarn workspaces monorepo for the geospatial SDK and POI taxonomy.

## Packages

| Package | Description |
|---|---|
| [`geokit`](packages/core/) | Core geo utilities and map UI |
| [`@geokit/api`](packages/api/) | Place search providers, composite routing, taxonomy hooks |
| [`@geokit/geotypes`](packages/geotypes/) | POI taxonomy (YAML, proto, slugs, acronyms) |
| [`@geokit/plugin-foursquare`](packages/plugin-foursquare/) | Foursquare Places search |
| [`@geokit/plugin-google`](packages/plugin-google/) | Google Places search |
| [`@geokit/plugin-mapbox`](packages/plugin-mapbox/) | Mapbox geocoding, isochrone, directions |
| [`@geokit/plugin-maptiler`](packages/plugin-maptiler/) | MapTiler geocoding |
| [`@geokit/plugin-here`](packages/plugin-here/) | HERE Places discover search |
| [`@geokit/plugin-osm`](packages/plugin-osm/) | OpenStreetMap Overpass place search |
| [`@geokit/plugin-esri`](packages/plugin-esri/) | Esri ArcGIS Places near-point search |

## Commands

```bash
yarn install
yarn build          # build geokit core
yarn test           # core + api + geotypes + plugin-osm tests
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

## Slim vs full install

| Need | Install |
|---|---|
| Geo utils + map UI only | `geokit` |
| Place search / geocoding / isochrones | `geokit` + `@geokit/api` |
| POI taxonomy (RSE, vendor crosswalks) | + `@geokit/geotypes` |
| HERE place search plugin | + `@geokit/plugin-here` |
| OSM fallback plugin | + `@geokit/plugin-osm` |

See [docs/migration-api.md](docs/migration-api.md) for import migration from legacy `geokit/api/*` paths.

See [docs/plugins.md](docs/plugins.md) for plugin authoring.
