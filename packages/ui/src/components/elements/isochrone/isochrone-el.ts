import type { IsochroneElementLike } from './isochrone-element-like.js';

export function isochroneEl(self: unknown): IsochroneElementLike {
  return self as IsochroneElementLike;
}
