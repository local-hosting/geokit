/**
 * Distance calculation utilities
 * Multiple algorithms for calculating distances between geographic coordinates
 */

// Haversine formula (most commonly used)
export { haversine, haversineMeters, haversineKm, haversineMiles } from './haversine';

// Vincenty formula (most accurate for long distances)
export { vincenty, vincentyMeters, vincentyKm, vincentyMiles } from './vincenty';

// Great Circle using spherical law of cosines (simple and fast)
export { greatCircle, greatCircleMeters, greatCircleKm, greatCircleMiles } from './great-circle';

// Rhumb line / loxodrome (constant bearing)
export { rhumbLine, rhumbLineMeters, rhumbLineKm, rhumbLineMiles } from './rhumb-line';

// Utility functions
export { withinDistance } from './utils';
