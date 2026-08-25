# Geokit docs

| Doc | Contents |
|-----|----------|
| [architecture.md](architecture.md) | Three-layer model, package graph, import tiers |
| [import-migration.md](import-migration.md) | Breaking import paths after the monorepo refactor |
| [providers.md](providers.md) | Map UI backends (MapTiler / Mapbox) |
| [events.md](events.md) | `gk-*` custom events |
| [parity.md](parity.md) | TypeScript ↔ Swift layout and fixture parity |
| [offline.md](offline.md) | Offline map contract (`@geokit/core/contract`, `@geokit/ui/storage`) |

## Package READMEs

| Package | README |
|---------|--------|
| `@geokit/core` | [packages/core/README.md](../packages/core/README.md) — geo utilities |
| `@geokit/ui` | Map Web Components (see architecture + events) |
| `@geokit/env` | `packages/env/` — service keys and map credentials |
| `@geokit/h3` | `packages/h3/` — H3 geometry (`h3-js` peer) |
| `@geokit/service` | `packages/service/` — registry and routing |
| `@geokit/crosswalk` | `packages/crosswalk/` — ZIP / DMA / H3 identity |

Start with [architecture.md](architecture.md) for the three-layer model (services, plugins, UI providers).
