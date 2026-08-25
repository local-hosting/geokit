/** Branded type for Geohash representing a point location */
export type GeohashPoint = string & { __brand: 'GeohashPoint' };

/** Branded type for Geohash representing an area/region */
export type GeohashArea = string & { __brand: 'GeohashArea' };

/** Branded type for H3 index representing a point location */
export type H3Point = string & { __brand: 'H3Point' };

/** Branded type for H3 index representing an area/region */
export type H3Area = string & { __brand: 'H3Area' };

/** Union type for all spatial index types */
export type SpatialIndex = GeohashPoint | GeohashArea | H3Point | H3Area;
