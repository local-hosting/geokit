/**
 * Turf packages that must not appear in static browser choke-point modules
 * (@turf/buffer → jsts UMD; @turf/convex → concaveman CJS). Tests enforce this list.
 */
export const TURF_BROWSER_FORBIDDEN = ['@turf/buffer', '@turf/convex'] as const;