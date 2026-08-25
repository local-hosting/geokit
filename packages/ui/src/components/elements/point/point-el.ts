import type { PointElementLike } from './point-element-like.js';

export function pointEl(self: unknown): PointElementLike {
  return self as PointElementLike;
}
