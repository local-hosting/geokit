/**
 * Offline map contract — shared with geokit-swift `GeoKitContract`.
 * Geokit stores map/runtime state only; domain data (markers, domain records) stays in the host app.
 */

export interface MapCameraFrame {
  centerLatitude: number;
  centerLongitude: number;
  zoom: number;
  bearing: number;
  pitch: number;
}

export type MapLocalPersistScope = 'memory' | 'session' | 'durable';

export interface MapLocalState {
  mapId: string;
  cameraFrame?: MapCameraFrame;
  /** Opaque pin id for UI restore — host resolves payload. */
  selectedPinId?: string;
  updatedAt: number;
  persistScope: MapLocalPersistScope;
}

export interface MapOfflineBounds {
  south: number;
  west: number;
  north: number;
  east: number;
}

export interface MapOfflineZoomRange {
  minZoom: number;
  maxZoom: number;
}

export type MapOfflinePolicy = 'onlineOnly' | 'cacheFirst' | 'snapshotFallback';

export type MapOfflineRegionStatus =
  | 'idle'
  | 'downloading'
  | 'partial'
  | 'ready'
  | 'failed';

export interface MapOfflineStorageBudget {
  maxBytes: number;
  maxPrefetchZoom: number;
  maxTileCount?: number;
}

export type MapOfflinePlatform = 'web' | 'nativeMapbox' | 'nativeMapKit';

export interface MapOfflineContextLoad {
  bounds: MapOfflineBounds;
  zoomRange?: MapOfflineZoomRange;
  policy?: MapOfflinePolicy;
  providerHint?: string;
}

export interface MapOfflineHostContext extends MapOfflineContextLoad {
  mapId: string;
}

export interface MapOfflinePrefetchRequest {
  mapId: string;
  bounds: MapOfflineBounds;
  zoomRange: MapOfflineZoomRange;
  providerHint?: string;
  budget?: MapOfflineStorageBudget;
}

export interface MapOfflineCoverage {
  status: MapOfflineRegionStatus;
  fractionComplete: number;
  tilesCached: number;
  tilesRequired: number;
  recommendsLiveMap: boolean;
  recommendsSnapshotFallback: boolean;
}

export const MapOfflineDefaults = {
  durablePersistScope: 'durable' as const,
  webStorageBudget: {
    maxBytes: 200 * 1024 * 1024,
    maxPrefetchZoom: 15,
    maxTileCount: 8_000,
  } satisfies MapOfflineStorageBudget,
  nativeMapboxStorageBudget: {
    maxBytes: 500 * 1024 * 1024,
    maxPrefetchZoom: 17,
  } satisfies MapOfflineStorageBudget,
  liveMapCoverageThreshold: 0.8,
  snapshotFallbackCoverageThreshold: 0.5,
  snapshotMaxBytesPerMap: 2 * 1024 * 1024,
  snapshotMaxBytesTotal: 20 * 1024 * 1024,
} as const;

export type MapOfflinePolicyErrorCode =
  | 'invalidBounds'
  | 'invalidZoomRange'
  | 'zoomRangeExceedsBudget'
  | 'estimatedTileCountExceedsBudget';

export class MapOfflinePolicyError extends Error {
  constructor(
    public readonly code: MapOfflinePolicyErrorCode,
    message: string
  ) {
    super(message);
    this.name = 'MapOfflinePolicyError';
  }
}

export function validateOfflineBounds(bounds: MapOfflineBounds): void {
  if (
    bounds.south >= bounds.north ||
    bounds.west >= bounds.east ||
    bounds.south < -90 ||
    bounds.north > 90 ||
    bounds.west < -180 ||
    bounds.east > 180
  ) {
    throw new MapOfflinePolicyError('invalidBounds', 'invalid offline bounds');
  }
}

export function defaultOfflineBudget(platform: MapOfflinePlatform): MapOfflineStorageBudget {
  switch (platform) {
    case 'web':
      return { ...MapOfflineDefaults.webStorageBudget };
    case 'nativeMapbox':
      return { ...MapOfflineDefaults.nativeMapboxStorageBudget };
    case 'nativeMapKit':
      return { maxBytes: 0, maxPrefetchZoom: 0, maxTileCount: 0 };
    default: {
      const _exhaustive: never = platform;
      return _exhaustive;
    }
  }
}

export function normalizeOfflineZoomRange(
  range: MapOfflineZoomRange,
  platform: MapOfflinePlatform
): MapOfflineZoomRange {
  const minZoom = Math.max(0, Math.min(range.minZoom, range.maxZoom));
  const maxCap =
    platform === 'web'
      ? MapOfflineDefaults.webStorageBudget.maxPrefetchZoom
      : MapOfflineDefaults.nativeMapboxStorageBudget.maxPrefetchZoom;
  const maxZoom = Math.min(22, Math.max(minZoom, Math.min(range.maxZoom, maxCap)));
  return { minZoom, maxZoom };
}

function tileXY(latitude: number, longitude: number, zoom: number): { x: number; y: number } {
  const scale = 2 ** zoom;
  const x = Math.floor(((longitude + 180) / 360) * scale);
  const latRad = (latitude * Math.PI) / 180;
  const y = Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * scale
  );
  return { x, y };
}

/** Rough Web-Mercator tile count for bbox × zoom levels (prefetch budget guard). */


export interface MapOfflineTileCoordinate {
  z: number;
  x: number;
  y: number;
}

/** Enumerate Web-Mercator tile coordinates for bounds × zoom levels. */
export function enumerateOfflineTileCoordinates(
  bounds: MapOfflineBounds,
  zoomRange: MapOfflineZoomRange
): MapOfflineTileCoordinate[] {
  if (bounds.south >= bounds.north || bounds.west >= bounds.east) return [];
  const tiles: MapOfflineTileCoordinate[] = [];
  for (let z = zoomRange.minZoom; z <= zoomRange.maxZoom; z += 1) {
    const northWest = tileXY(bounds.north, bounds.west, z);
    const southEast = tileXY(bounds.south, bounds.east, z);
    for (let x = northWest.x; x <= southEast.x; x += 1) {
      for (let y = northWest.y; y <= southEast.y; y += 1) {
        tiles.push({ z, x, y });
      }
    }
  }
  return tiles;
}

/** Replace `{z}`, `{x}`, `{y}` in a raster/vector tile URL template. */


export function defaultOfflineZoomRangeForMap(
  centerZoom: number,
  platform: MapOfflinePlatform = 'web'
): MapOfflineZoomRange {
  const budget = defaultOfflineBudget(platform);
  const maxZoom = Math.min(Math.round(centerZoom) + 1, budget.maxPrefetchZoom);
  const minZoom = Math.max(0, maxZoom - 3);
  return { minZoom, maxZoom };
}

/** Derive offline bounds from pin coordinates with optional padding (degrees). */
export function resolveOfflineBoundsFromPins(
  pins: Array<{ latitude: number; longitude: number }>,
  padding = 0.01
): MapOfflineBounds | null {
  if (pins.length === 0) return null;
  let south = pins[0].latitude;
  let north = pins[0].latitude;
  let west = pins[0].longitude;
  let east = pins[0].longitude;
  for (const pin of pins) {
    south = Math.min(south, pin.latitude);
    north = Math.max(north, pin.latitude);
    west = Math.min(west, pin.longitude);
    east = Math.max(east, pin.longitude);
  }
  return {
    south: south - padding,
    north: north + padding,
    west: west - padding,
    east: east + padding,
  };
}

export function buildOfflineTileUrl(
  template: string,
  tile: MapOfflineTileCoordinate
): string {
  return template
    .replace(/{z}/g, String(tile.z))
    .replace(/{x}/g, String(tile.x))
    .replace(/{y}/g, String(tile.y));
}

export function estimateOfflineTileCount(
  bounds: MapOfflineBounds,
  zoomRange: MapOfflineZoomRange
): number {
  if (bounds.south >= bounds.north || bounds.west >= bounds.east) return 0;
  let total = 0;
  for (let zoom = zoomRange.minZoom; zoom <= zoomRange.maxZoom; zoom += 1) {
    const northWest = tileXY(bounds.north, bounds.west, zoom);
    const southEast = tileXY(bounds.south, bounds.east, zoom);
    total += (southEast.x - northWest.x + 1) * (southEast.y - northWest.y + 1);
  }
  return Math.max(total, 0);
}

export function offlineRegionStatus(fractionComplete: number): MapOfflineRegionStatus {
  if (fractionComplete >= 0.95) return 'ready';
  if (fractionComplete >= 0.5) return 'partial';
  return 'idle';
}

export function resolveOfflineCoverage(
  tilesCached: number,
  tilesRequired: number,
  policy: MapOfflinePolicy
): MapOfflineCoverage {
  const required = Math.max(tilesRequired, 0);
  const cached = Math.max(Math.min(tilesCached, required), 0);
  const fraction = required === 0 ? 1 : cached / required;
  const status = offlineRegionStatus(fraction);
  const recommendsLiveMap =
    policy !== 'onlineOnly' && fraction >= MapOfflineDefaults.liveMapCoverageThreshold;
  const recommendsSnapshotFallback =
    policy === 'snapshotFallback' &&
    fraction < MapOfflineDefaults.snapshotFallbackCoverageThreshold;
  return {
    status,
    fractionComplete: fraction,
    tilesCached: cached,
    tilesRequired: required,
    recommendsLiveMap,
    recommendsSnapshotFallback,
  };
}

export function validateOfflinePrefetchRequest(
  request: MapOfflinePrefetchRequest,
  platform: MapOfflinePlatform
): MapOfflinePrefetchRequest {
  validateOfflineBounds(request.bounds);
  const budget = request.budget ?? defaultOfflineBudget(platform);
  const zoomRange = normalizeOfflineZoomRange(request.zoomRange, platform);
  if (zoomRange.minZoom > zoomRange.maxZoom) {
    throw new MapOfflinePolicyError('invalidZoomRange', 'invalid zoom range');
  }
  if (zoomRange.maxZoom > budget.maxPrefetchZoom) {
    throw new MapOfflinePolicyError(
      'zoomRangeExceedsBudget',
      `max zoom ${zoomRange.maxZoom} exceeds budget ${budget.maxPrefetchZoom}`
    );
  }
  const tileCount = estimateOfflineTileCount(request.bounds, zoomRange);
  if (budget.maxTileCount != null && tileCount > budget.maxTileCount) {
    throw new MapOfflinePolicyError(
      'estimatedTileCountExceedsBudget',
      `estimated ${tileCount} tiles exceeds budget ${budget.maxTileCount}`
    );
  }
  return { ...request, zoomRange, budget };
}
