# Geokit monorepo

Yarn workspaces monorepo for the geospatial SDK and POI taxonomy.

## Packages

| Package | Description |
|---|---|
| [`geokit`](packages/core/) | Core geo utilities and map UI |
| [`@geokit/api`](packages/api/) | API registry, composite routing, plugin hooks, taxonomy |
| [`@geokit/geotypes`](packages/geotypes/) | POI taxonomy (YAML, proto, slugs, acronyms) |
| [`@geokit/plugin-foursquare`](packages/plugin-foursquare/) | Foursquare Places search |
| [`@geokit/plugin-google`](packages/plugin-google/) | Google Places search |
| [`@geokit/plugin-mapbox`](packages/plugin-mapbox/) | Mapbox geocoding, isochrone, directions |
| [`@geokit/plugin-maptiler`](packages/plugin-maptiler/) | MapTiler geocoding |
| [`@geokit/plugin-here`](packages/plugin-here/) | HERE Places discover search |
| [`@geokit/plugin-osm`](packages/plugin-osm/) | OpenStreetMap Overpass place search |
| [`@geokit/plugin-esri`](packages/plugin-esri/) | Esri ArcGIS Places near-point search |


## Terminology: API providers, plugins, UI providers

Geokit uses three distinct layers — see [docs/architecture-providers.md](docs/architecture-providers.md):

| Layer | Package | Role |
|-------|---------|------|
| **API provider** | `@geokit/api` + `@geokit/plugin-*` | HTTP: place search, geocoding, isochrones |
| **Plugin** | `@geokit/plugin-*` | npm install boundary + registration wrapper |
| **UI provider** | `geokit` (`src/ui/providers/`) | Map rendering (MapTiler / Mapbox GL) |

## Commands

```bash
yarn install
yarn build          # build geokit core
yarn test           # core + api + geotypes + plugin-osm tests
yarn typecheck      # all packages
yarn demo              # interactive map demos (repo-root demo/)
yarn workspace geokit run dev   # same demo server from core package
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

## Slim vs full install

| Need | Install |
|---|---|
| Geo utils + map UI only | `geokit` |
| Place search / geocoding / isochrones | `geokit` + `@geokit/api` |
| POI taxonomy (RSE, vendor crosswalks) | + `@geokit/geotypes` |
| HERE place search plugin | + `@geokit/plugin-here` |
| OSM fallback plugin | + `@geokit/plugin-osm` |

See [docs/architecture-providers.md](docs/architecture-providers.md) for the three-layer model.

See [docs/migration-api.md](docs/migration-api.md) for import migration.

See [docs/plugins.md](docs/plugins.md) for plugin authoring.
