import { styleImageLayoutPixels } from '../map-surface/map-style-images';
import {
  sharedPointFloatingBadgeRadiusExpression,
  sharedPointFloatingBadgeSelectedRadiusExpression,
} from './shared-point-paint';

/** Badge image width as a share of the key-colored core disk diameter. */
export const SHARED_POINT_BADGE_ICON_DISK_FILL = 0.9;

/**
 * Zoomed-out glyph fill (share of core diameter) — the core shrinks faster than the
 * ring, so the glyph spills into the ring to stay legible. Ends at the default fill.
 */
const SHARED_POINT_BADGE_ICON_ZOOM_FILL: ReadonlyArray<readonly [number, number]> = [
  [8, 2],
  [10, 1.6],
  [12, 1.2],
  [14, SHARED_POINT_BADGE_ICON_DISK_FILL],
];

function badgeIconFillAtZoom(zoom: number): number {
  const stops = SHARED_POINT_BADGE_ICON_ZOOM_FILL;
  if (zoom <= stops[0][0]) return stops[0][1];
  for (let i = 1; i < stops.length; i++) {
    const [z1, f1] = stops[i];
    if (zoom <= z1) {
      const [z0, f0] = stops[i - 1];
      return f0 + ((zoom - z0) / (z1 - z0)) * (f1 - f0);
    }
  }
  return SHARED_POINT_BADGE_ICON_DISK_FILL;
}

/** Glyph diameter per zoom stop of a core-radius interpolate expression. */
export function sharedPointBadgeIconSizeForRadiusExpression(radius: unknown[]): unknown[] {
  const pixels = styleImageLayoutPixels();
  return radius.map((value, index) =>
    index >= 4 && index % 2 === 0 && typeof value === 'number'
      ? (value * 2 * badgeIconFillAtZoom(radius[index - 1] as number)) / pixels
      : value
  );
}

/** Zoom-scaled `icon-size` that keeps a raster-size badge image centered on the core disk. */
export function sharedPointBadgeIconSizeExpression(): unknown[] {
  return sharedPointBadgeIconSizeForRadiusExpression(sharedPointFloatingBadgeRadiusExpression());
}

/**
 * Glyph icon scale — matches the place badge **core** (not the full stacked diameter).
 * Scaling the glyph to the outer disc makes the white faces cover the key fill.
 */
export function sharedPointBadgeIconSizeForGlyphDiskExpression(): unknown[] {
  return sharedPointBadgeIconSizeForRadiusExpression(
    sharedPointFloatingBadgeSelectedRadiusExpression() as unknown[]
  );
}
