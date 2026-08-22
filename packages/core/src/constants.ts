/**
 * Geospatial constants used throughout the library
 */

/**
 * Earth's radius in meters (mean radius)
 */
export const EARTH_RADIUS_METERS = 6371000;

/**
 * Earth's radius in kilometers (mean radius)
 */
export const EARTH_RADIUS_KM = 6371;

/**
 * Earth's radius in miles (mean radius)
 */
export const EARTH_RADIUS_MILES = 3959;

/**
 * Earth's radius in meters (WGS-84 ellipsoid)
 */
export const EARTH_RADIUS_WGS84_METERS = 6378137;

/**
 * Earth's radius in kilometers (WGS-84 ellipsoid)
 */
export const EARTH_RADIUS_WGS84_KM = 6378.137;

/**
 * Earth's radius in miles (WGS-84 ellipsoid)
 */
export const EARTH_RADIUS_WGS84_MILES = 3963.191;

/**
 * Earth's flattening factor (WGS-84)
 */
export const EARTH_FLATTENING_WGS84 = 1 / 298.257223563;

/**
 * Meters per degree at the equator
 */
export const METERS_PER_DEGREE_EQUATOR = 111320;

/**
 * Conversion factors
 */
export const METERS_TO_KILOMETERS = 1000;
export const METERS_TO_MILES = 1609.34;
export const SQUARE_METERS_TO_SQUARE_KILOMETERS = 1000000;
export const SQUARE_METERS_TO_SQUARE_MILES = 2589988.110336;
export const SQUARE_METERS_TO_ACRES = 4046.8564224;

/**
 * Coordinate bounds
 */
export const MIN_LATITUDE = -90;
export const MAX_LATITUDE = 90;
export const MIN_LONGITUDE = -180;
export const MAX_LONGITUDE = 180;
export const DEGREES_IN_CIRCLE = 360;

/**
 * Mathematical constants
 */
export const DEGREES_TO_RADIANS = Math.PI / 180;
export const RADIANS_TO_DEGREES = 180 / Math.PI;
export const TWO_PI = 2 * Math.PI;

/**
 * Longitude normalization constant
 * Used in formula: ((lon + 540) % 360) - 180
 */
export const LONGITUDE_NORMALIZATION_OFFSET = 540;

/**
 * Default values
 */
export const DEFAULT_BUFFER_STEPS = 64;

/**
 * DMS (Degrees, Minutes, Seconds) conversion constants
 */
export const SECONDS_PER_MINUTE = 60;
export const SECONDS_PER_DEGREE = 3600;
