/** Rounded-rect marker rasters — analytic, so they need no canvas and stay crisp when scaled. */

/** Badge rect inset from the raster edge (room for the SDF spread). */
export const ROUNDED_RECT_SDF_INSET_RATIO = 0.08;
/** Corner radius as a fraction of the badge rect width. */
const CORNER_RATIO = 0.22 / (1 - 2 * ROUNDED_RECT_SDF_INSET_RATIO);
/** MapLibre SDF convention: alpha 0.75 at the edge (tiny-sdf cutoff 0.25). */
const SDF_CUTOFF = 0.25;

/** Signed distance from pixel center to a centered rounded rect (negative inside). */
function roundedRectDistance(x: number, y: number, size: number, inset: number): number {
  const half = size / 2 - inset;
  const radius = Math.min(half, half * 2 * CORNER_RATIO);
  const qx = Math.abs(x + 0.5 - size / 2) - (half - radius);
  const qy = Math.abs(y + 0.5 - size / 2) - (half - radius);
  const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0));
  return outside + Math.min(Math.max(qx, qy), 0) - radius;
}

function fillRaster(
  size: number,
  rgb: number,
  alphaForDistance: (distance: number) => number,
  inset: number
): Uint8ClampedArray {
  const data = new Uint8ClampedArray(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      data[i] = rgb;
      data[i + 1] = rgb;
      data[i + 2] = rgb;
      data[i + 3] = alphaForDistance(roundedRectDistance(x, y, size, inset));
    }
  }
  return data;
}

/** White SDF rounded rect (`sdf: true`) — linear distance falloff gives anti-aliased edges. */
export function roundedRectSdfRaster(size: number): Uint8ClampedArray {
  const spread = size * ROUNDED_RECT_SDF_INSET_RATIO;
  return fillRaster(
    size,
    255,
    (d) => 255 * (1 - (d / spread + SDF_CUTOFF)),
    spread
  );
}

/**
 * Black pre-blurred rounded rect (non-SDF), same geometry as the SDF badge rect.
 * Falloff mirrors MapLibre `circle-blur`: solid inside `(1 - blur)` of the half-width,
 * smoothstep to clear at the edge.
 */
export function roundedRectShadowRaster(size: number, blur: number): Uint8ClampedArray {
  const inset = size * ROUNDED_RECT_SDF_INSET_RATIO;
  const fade = Math.max(1, (size / 2 - inset) * blur);
  return fillRaster(
    size,
    0,
    (d) => {
      const t = Math.min(1, Math.max(0, -d / fade));
      return 255 * t * t * (3 - 2 * t);
    },
    inset
  );
}
