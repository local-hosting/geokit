/**
 * H3 helpers for map UI (gk-h3): projection + disk rings only — no crosswalk rollups.
 */

export {
  coordinatesToH3,
  h3GetResolution,
  h3ToCoordinates,
  validateH3,
} from './geometry/core';
export { h3DiskToFeatureCollection } from './geometry/disk-features';