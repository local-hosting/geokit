/**
 * Platform H3 and geohash tier contract — shared across CDN export, crosswalk, and map grid.
 */

import { GEOHASH_ZIP_INDEX_PRECISION } from './geohash/cell-id.js';

/** Valid H3 resolution range (h3-js). */
export const H3_MIN_RESOLUTION = 0;
export const H3_MAX_RESOLUTION = 15;

/** Coarse global hero / low-zoom DMA tier. */
export const PLATFORM_H3_HERO_RESOLUTION = 0;

/** Place sync and default platform map grid (H3). */
export const PLATFORM_H3_RESOLUTION = 1;

/** Native zip-h3-index resolution (do not use for platform grid). */
export const H3_ZIP_INDEX_RESOLUTION = 5;

/** Crosswalk rollup resolution in crosswalk compile (h3-r4-to-zips). */
export const PLATFORM_H3_REFERENCE_RESOLUTION = 4;

/** CDN /h3/r{N}/… crosswalk tiers — full h3-js range, rolled up or refined from r5. */
export const PLATFORM_H3_CROSSWALK_TIERS = Array.from(
  { length: H3_MAX_RESOLUTION - H3_MIN_RESOLUTION + 1 },
  (_, index) => H3_MIN_RESOLUTION + index,
) as readonly number[];

/** CDN export cap — r7+ refine explodes; resolve API still supports r7–r15. */
export const PLATFORM_H3_CROSSWALK_EXPORT_MAX = 6;

/** Resolutions materialized to /h3/r{N}/ during CDN dist. */
export const PLATFORM_H3_CROSSWALK_EXPORT_TIERS = PLATFORM_H3_CROSSWALK_TIERS.filter(
  (resolution) => resolution <= PLATFORM_H3_CROSSWALK_EXPORT_MAX,
) as readonly number[];

export type PlatformH3CrosswalkTier = (typeof PLATFORM_H3_CROSSWALK_TIERS)[number];

/** @deprecated Use PLATFORM_H3_RESOLUTION */
export const VENUE_H3_RESOLUTION = PLATFORM_H3_RESOLUTION;

/** @deprecated Use PLATFORM_H3_RESOLUTION */
export const PLACE_H3_RESOLUTION = PLATFORM_H3_RESOLUTION;

/** Valid geohash precision range. */
export const GEOHASH_MIN_PRECISION = 1;
export const GEOHASH_MAX_PRECISION = 12;

/** Platform map grid and default CDN browse tier (geohash). */
export const PLATFORM_GEOHASH_PRECISION = 6;

/** Native geohash precision for ZIP index (built from H3 r5 footprints). */
export { GEOHASH_ZIP_INDEX_PRECISION };

/** CDN /gh/p{N}/… crosswalk tiers — full geohash range, rolled up or refined from p8. */
export const PLATFORM_GEOHASH_CROSSWALK_TIERS = Array.from(
  { length: GEOHASH_MAX_PRECISION - GEOHASH_MIN_PRECISION + 1 },
  (_, index) => GEOHASH_MIN_PRECISION + index,
) as readonly number[];

/** CDN export cap — p7+ rollups and p9–p12 re-encode explode; parallel to H3 r6 cap. */
export const PLATFORM_GEOHASH_CROSSWALK_EXPORT_MAX = 6;

/** Precisions materialized to /gh/p{N}/ during CDN dist. */
export const PLATFORM_GEOHASH_CROSSWALK_EXPORT_TIERS = PLATFORM_GEOHASH_CROSSWALK_TIERS.filter(
  (precision) => precision <= PLATFORM_GEOHASH_CROSSWALK_EXPORT_MAX,
) as readonly number[];

export type PlatformGeohashCrosswalkTier = (typeof PLATFORM_GEOHASH_CROSSWALK_TIERS)[number];
