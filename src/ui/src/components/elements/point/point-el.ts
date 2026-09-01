import type { PointElementLike } from './point-element-like';

export function pointEl(self: unknown): PointElementLike {
  return self as PointElementLike;
}
