# Geokit tests

## Layout

| Path                              | Purpose                                                                                   |
| --------------------------------- | ----------------------------------------------------------------------------------------- |
| `tests/unit/`                     | Fast unit tests (happy-dom). Mirrors `src/` areas: `api`, `config`, `ui`, `utils`. |
| `tests/unit/ui/browser/`          | Playwright browser tests (`yarn test:browser`) — real WebGL for map controls.             |
| `tests/integration/`              | Live API smoke tests (`yarn test:integration`). Skips when env keys are missing.          |
| `tests/integration/demo-smoke.ts` | Playwright smoke test for `demo/` pages (`yarn test:demo`).                               |
| `tests/fixtures/`                 | Reusable GeoJSON, coordinates, and map boot helpers.                                      |
| `tests/mocks/`                    | Provider stubs and fetch helpers.                                                         |
| `tests/setup/`                    | Vitest setup (polyfills) and shared test hooks.                                           |

## Shared modules

| Module                              | Use when                                                 |
| ----------------------------------- | -------------------------------------------------------- |
| `fixtures/locations.ts`             | Standard NYC/Chicago coordinates and map defaults        |
| `fixtures/geojson.ts`               | Reusable polygons and isochrone FeatureCollections       |
| `fixtures/map-with-controls.ts`     | Browser map boot (`createMapWithControlsFixture`)        |
| `mocks/mock-api-provider.ts`        | Registry / integration API provider stub                 |
| `mocks/mock-ui-provider.ts`         | UI provider stub                                         |
| `mocks/fetch.ts`                    | `mockGlobalFetchJson`, `useFetchStub`                    |
| `setup/registries.ts`               | `useCleanAPIRegistry`, `useCleanProviderRegistries`      |
| `setup/browser-env.ts`              | `isHeadlessDomTestEnv()` for skip guards                 |
| `setup/jsdom-window.ts`             | Explicit jsdom globals only when isolated from happy-dom |
| `setup/happy-dom-polyfills.ts`      | Vitest unit setup (WebGL, Worker, ResizeObserver)        |
| `setup/browser-console-suppress.ts` | Vitest browser setup                                     |

Prefer happy-dom's built-in DOM in unit tests. Avoid `installJsdomWindow()` in the default suite — replacing globals breaks later tests that load UI modules.

## Commands

```bash
yarn test                  # unit tests (excludes browser + integration)
yarn test:browser          # Playwright map/control tests
yarn test:integration      # live provider smoke tests
yarn test:demo             # Playwright smoke test for demo/ pages
yarn test:all              # unit + integration
```

## Naming

Prefer **behavior-oriented** test file names when the source module name is ambiguous:

- `dma-shape-resolve.test.ts` — DMA slug parsing and shape loading
- `provider-registry-integration.test.ts` — UI + API registry wiring
- `web-component-dom-api.test.ts` — DOM/custom-element primitives (not gk-\* components)

Keep 1:1 names when the test clearly maps to one module (`mapbox-provider.test.ts`, `resolve-map-input.test.ts`).
