import type { MapCollectionElementLike } from './map-collection-element-like';

export function mapCollectionEl(self: unknown): MapCollectionElementLike {
  return self as MapCollectionElementLike;
}
