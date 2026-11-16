# Geokit monorepo

Yarn workspaces monorepo for the geospatial SDK.

## Packages

| Package | Path | Description |
|---------|------|-------------|
| `@doppler-group/geokit/env` | `src/env/` | Service keys and map credential bootstrap |
| `@doppler-group/geokit/h3` | `src/h3/` | H3 hex grid geometry (peer: `h3-js`) |
| `@doppler-group/geokit/core` | `src/core/` | Core geo utilities (slim; no map UI) |
| `@doppler-group/geokit/ui` | `src/ui/` | Map Web Components, storage, adapters |
| `@doppler-group/geokit/service` | `src/service/` | API registry, composite routing, plugin hooks |
| `@doppler-group/geokit/crosswalk` | `src/crosswalk/` | Geo identity crosswalk (H3, ZIP, DMA, …) |
| `@doppler-group/geokit/foursquare` | `src/providers/foursquare/` | Foursquare Places search |
| `@doppler-group/geokit/google` | `src/providers/google/` | Google Places search |
| `@doppler-group/geokit/mapbox` | `src/providers/mapbox/` | Mapbox geocoding, isochrone, directions |
| `@doppler-group/geokit/maptiler` | `src/providers/maptiler/` | MapTiler geocoding |
| `@doppler-group/geokit/here` | `src/providers/here/` | HERE Places discover search |
| `@doppler-group/geokit/osm` | `src/providers/osm/` | OpenStreetMap Overpass place search |
| `@doppler-group/geokit/esri` | `src/providers/esri/` | Esri ArcGIS Places near-point search |

## Docs

See [docs/README.md](docs/README.md). Start with [docs/architecture.md](docs/architecture.md) for the three-layer model.

## Commands

```bash
yarn install
yarn build          # build @doppler-group/geokit/core and @doppler-group/geokit/ui
yarn build:all      # build every workspace package
yarn test           # all workspaces
yarn typecheck      # all workspaces
yarn demo           # interactive map demos (demo/)
```


Package API reference: [src/core/README.md](src/core/README.md).


## Slim vs full install

| Need | Install |
|------|---------|
| Geo utils only | `@doppler-group/geokit/core` |
| Map UI | `@doppler-group/geokit/ui` |
| Place search / geocoding / isochrones | + `@doppler-group/geokit/service` |
| Vendor APIs | + `src/providers/*` packages as needed |

## Publishing (@doppler-group/geokit/*)

Packages publish to GitHub Packages on tag push:

```bash
git tag v0.2.33
git push origin v0.2.33
```

Or run **Actions → Publish GitHub Packages → Run workflow**.

Consumers need `.npmrc`:

```ini
@twinfile:registry=https://npm.pkg.github.com
```

CI/Vercel: `NODE_AUTH_TOKEN` with `read:packages` (or `GITHUB_TOKEN` in Actions).
