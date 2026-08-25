# Geokit monorepo

Yarn workspaces monorepo for the geospatial SDK and POI taxonomy.

## Packages

| Package | Path | Description |
|---------|------|-------------|
| `@geokit/core` | `packages/core/` | Core geo utilities and map UI |
| `@geokit/service` | `packages/service/` | API registry, composite routing, plugin hooks |
| `@geokit/geotypes` | `packages/geotypes/` | POI taxonomy (YAML, proto, slugs, acronyms) |
| `@geokit/crosswalk` | `packages/crosswalk/` | Geo identity crosswalk (H3, ZIP, DMA, …) |
| `@geokit/foursquare` | `services/foursquare/` | Foursquare Places search |
| `@geokit/google` | `services/google/` | Google Places search |
| `@geokit/mapbox` | `services/mapbox/` | Mapbox geocoding, isochrone, directions |
| `@geokit/maptiler` | `services/maptiler/` | MapTiler geocoding |
| `@geokit/here` | `services/here/` | HERE Places discover search |
| `@geokit/osm` | `services/osm/` | OpenStreetMap Overpass place search |
| `@geokit/esri` | `services/esri/` | Esri ArcGIS Places near-point search |

## Docs

See [docs/README.md](docs/README.md). Start with [docs/architecture.md](docs/architecture.md) for the three-layer model (services, plugins, UI providers).

## Commands

```bash
yarn install
yarn build          # build @geokit/core
yarn test           # all workspaces
yarn typecheck      # all workspaces
yarn demo           # interactive map demos (demo/)
```

```bash
yarn workspace @geokit/geotypes run sync   # slugs + acronyms + provider tables
yarn workspace @geokit/geotypes run open   # Clay taxonomy preview
```

Package API reference: [packages/core/README.md](packages/core/README.md).

## Place taxonomy

```typescript
import { setPlaceTaxonomyResolver } from '@geokit/service/place-taxonomy';
import { createGeokitTaxonomyResolver } from '@geokit/geotypes/geokit';

setPlaceTaxonomyResolver(createGeokitTaxonomyResolver());

// placeSearch({ geotypes: ['RSE'], ll: [...] }) → Foursquare/Google category params
```

## Slim vs full install

| Need | Install |
|------|---------|
| Geo utils + map UI only | `@geokit/core` |
| Place search / geocoding / isochrones | + `@geokit/service` |
| POI taxonomy | + `@geokit/geotypes` |
| Vendor APIs | + `services/*` packages as needed |
