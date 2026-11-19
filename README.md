# Geokit monorepo

**Canonical single source** for the JS geospatial SDK (`@local-hosting/geokit`). Sibling checkout under [`local-hosting/geokit`](../); remote `github.com/local-hosting/geokit`.

Yarn workspaces monorepo for the geospatial SDK.

## Packages

| Package | Path | Description |
|---------|------|-------------|
| `@local-hosting/geokit/env` | `src/env/` | Service keys and map credential bootstrap |
| `@local-hosting/geokit/h3` | `src/h3/` | H3 hex grid geometry (peer: `h3-js`) |
| `@local-hosting/geokit/core` | `src/core/` | Core geo utilities (slim; no map UI) |
| `@local-hosting/geokit/ui` | `src/ui/` | Map Web Components, storage, adapters |
| `@local-hosting/geokit/service` | `src/service/` | API registry, composite routing, plugin hooks |
| `@local-hosting/geokit/crosswalk` | `src/crosswalk/` | Geo identity crosswalk (H3, ZIP, DMA, …) |
| `@local-hosting/geokit/foursquare` | `src/providers/foursquare/` | Foursquare Places search |
| `@local-hosting/geokit/google` | `src/providers/google/` | Google Places search |
| `@local-hosting/geokit/mapbox` | `src/providers/mapbox/` | Mapbox geocoding, isochrone, directions |
| `@local-hosting/geokit/maptiler` | `src/providers/maptiler/` | MapTiler geocoding |
| `@local-hosting/geokit/here` | `src/providers/here/` | HERE Places discover search |
| `@local-hosting/geokit/osm` | `src/providers/osm/` | OpenStreetMap Overpass place search |
| `@local-hosting/geokit/esri` | `src/providers/esri/` | Esri ArcGIS Places near-point search |

## Docs

See [docs/README.md](docs/README.md). Start with [docs/architecture.md](docs/architecture.md) for the three-layer model.

## Commands

```bash
yarn install
yarn build          # build @local-hosting/geokit/core and @local-hosting/geokit/ui
yarn build:all      # build every workspace package
yarn test           # all workspaces
yarn typecheck      # all workspaces
yarn demo           # interactive map demos (demo/)
```


Package API reference: [src/core/README.md](src/core/README.md).


## Slim vs full install

| Need | Install |
|------|---------|
| Geo utils only | `@local-hosting/geokit/core` |
| Map UI | `@local-hosting/geokit/ui` |
| Place search / geocoding / isochrones | + `@local-hosting/geokit/service` |
| Vendor APIs | + `src/providers/*` packages as needed |

## Publishing (@local-hosting/geokit/*)

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
