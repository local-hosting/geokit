# Geokit monorepo

Yarn workspaces monorepo for the geospatial SDK.

## Packages

| Package | Path | Description |
|---------|------|-------------|
| `@geokit/env` | `packages/env/` | Service keys and map credential bootstrap |
| `@geokit/h3` | `packages/h3/` | H3 hex grid geometry (peer: `h3-js`) |
| `@geokit/core` | `packages/core/` | Core geo utilities (slim; no map UI) |
| `@geokit/ui` | `packages/ui/` | Map Web Components, storage, adapters |
| `@geokit/service` | `packages/service/` | API registry, composite routing, plugin hooks |
| `@geokit/crosswalk` | `packages/crosswalk/` | Geo identity crosswalk (H3, ZIP, DMA, …) |
| `@geokit/foursquare` | `services/foursquare/` | Foursquare Places search |
| `@geokit/google` | `services/google/` | Google Places search |
| `@geokit/mapbox` | `services/mapbox/` | Mapbox geocoding, isochrone, directions |
| `@geokit/maptiler` | `services/maptiler/` | MapTiler geocoding |
| `@geokit/here` | `services/here/` | HERE Places discover search |
| `@geokit/osm` | `services/osm/` | OpenStreetMap Overpass place search |
| `@geokit/esri` | `services/esri/` | Esri ArcGIS Places near-point search |

## Docs

See [docs/README.md](docs/README.md). Start with [docs/architecture.md](docs/architecture.md) for the three-layer model.

## Commands

```bash
yarn install
yarn build          # build @geokit/core and @geokit/ui
yarn build:all      # build every workspace package
yarn test           # all workspaces
yarn typecheck      # all workspaces
yarn demo           # interactive map demos (demo/)
```


Package API reference: [packages/core/README.md](packages/core/README.md).


## Slim vs full install

| Need | Install |
|------|---------|
| Geo utils only | `@geokit/core` |
| Map UI | `@geokit/ui` |
| Place search / geocoding / isochrones | + `@geokit/service` |
| Vendor APIs | + `services/*` packages as needed |

## Publishing (@geokit/*)

Packages publish to GitHub Packages on tag push:

```bash
git tag v0.2.33
git push origin v0.2.33
```

Or run **Actions → Publish GitHub Packages → Run workflow**.

Consumers need `.npmrc`:

```ini
@geokit:registry=https://npm.pkg.github.com
```

CI/Vercel: `NODE_AUTH_TOKEN` with `read:packages` (or `GITHUB_TOKEN` in Actions).
