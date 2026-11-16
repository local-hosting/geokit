# Offline maps

Shared contract in `@local-hosting/geokit/core/contract`. Web storage in `@local-hosting/geokit/ui/storage`. Swift mirror: [`geokit-swift/docs/offline.md`](../../geokit-swift/docs/offline.md).

Geokit stores **map runtime state** (camera, tile cache, snapshots) keyed by `mapId`. Domain data (venues, markers, sync) stays in the host app.

## Key types

| Type | Purpose |
|------|---------|
| `MapLocalState` | Per-`mapId` camera + `selectedPinId` |
| `MapLocalPersistScope` | `memory` \| `session` \| `durable` |
| `MapOfflinePrefetchRequest` | Cache tiles for bounds + zoom range |
| `MapOfflinePolicy` | `onlineOnly` \| `cacheFirst` \| `snapshotFallback` |

## Web imports

```typescript
import { MapOfflineDefaults, validateOfflinePrefetchRequest } from '@local-hosting/geokit/core/contract';
import { MapLocalStore, MapOfflineTileCache, MapOfflineContextLoader } from '@local-hosting/geokit/ui/storage';
```

## Defaults (`MapOfflineDefaults`)

| Setting | Web | Native Mapbox |
|---------|-----|---------------|
| Storage budget | 200 MB | 500 MB |
| Max prefetch zoom | z15 | z17 |
| Max tile count | 8,000 | — |

Coverage policy:

- `liveMapCoverageThreshold`: 0.8 — recommend live map when cache coverage ≥ 80%
- `snapshotFallbackCoverageThreshold`: 0.5 — recommend snapshot fallback when coverage < 50%
- Snapshot limits: 2 MB per map, 20 MB total

Use `validateOfflinePrefetchRequest()` before prefetching; it enforces zoom range and tile-count budgets.

## Not stored by geokit

Venue/marker documents, auth tokens, signed geo URLs, application datasets.
