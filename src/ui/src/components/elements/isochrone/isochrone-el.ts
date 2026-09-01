import type { IsochroneElementLike } from './isochrone-element-like';

export function isochroneEl(self: unknown): IsochroneElementLike {
  return self as IsochroneElementLike;
}
