import type { MapElementLike } from './map-element-like.js';

/** Access methods defined later in the MapElement mixin chain. */
export function mapEl(self: unknown): MapElementLike {
  return self as MapElementLike;
}
