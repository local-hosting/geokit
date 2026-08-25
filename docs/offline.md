# Offline maps

Shared contract in `@geokit/core/contract`. Web storage in `@geokit/core/storage`. Swift mirror: [`geokit-swift/docs/offline.md`](../../geokit-swift/docs/offline.md).

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
import { MapOfflineDefaults, validateOfflinePrefetchRequest } from '@geokit/core/contract';
import { MapLocalStore, MapOfflineTileCache, MapOfflineContextLoader } from '@geokit/core/storage';
```

## Defaults

- Web storage budget: 200 MB, max prefetch zoom z15
- Native Mapbox budget: 500 MB, max prefetch zoom z17

## Not stored by geokit

Venue/marker documents, auth tokens, signed geo URLs, application datasets.
