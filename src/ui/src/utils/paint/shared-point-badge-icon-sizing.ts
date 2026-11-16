import { styleImageLayoutPixels } from '../map-surface/map-style-images';
import {
  scaleInterpolateRadiusStops,
  SHARED_POINT_FLOATING_BADGE_RADIUS_EXPRESSION,
  sharedPointFloatingBadgeSelectedRadiusExpression,
} from './shared-point-paint';

/** Badge image width as a share of the key-colored core disk diameter. */
export const SHARED_POINT_BADGE_ICON_DISK_FILL = 0.9;

/** Zoom-scaled `icon-size` that keeps a raster-size badge image centered inside the core disk. */
export function sharedPointBadgeIconSizeExpression(): unknown[] {
  return scaleInterpolateRadiusStops(
    SHARED_POINT_FLOATING_BADGE_RADIUS_EXPRESSION,
    (2 * SHARED_POINT_BADGE_ICON_DISK_FILL) / styleImageLayoutPixels()
  );
}

/**
 * Glyph icon scale — matches the place badge **core** (not the full stacked diameter).
 * Scaling the glyph to the outer disc makes the white faces cover the key fill.
 */
export function sharedPointBadgeIconSizeForGlyphDiskExpression(): unknown[] {
  const selectedRadius = sharedPointFloatingBadgeSelectedRadiusExpression();
  return scaleInterpolateRadiusStops(
    selectedRadius,
    (2 * SHARED_POINT_BADGE_ICON_DISK_FILL) / styleImageLayoutPixels()
  );
}