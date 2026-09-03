/**
 * GeoDrop - Modular utilities for converting geographic data formats to GeoJSON
 * 
 * Supports:
 * - Shapefiles (.shp) - direct reading and from ZIP files
 * - CSV files with H3 hexagon IDs
 * - ZIP file extraction for shapefile components
 */

// Re-export geokit types
export type {
  Polygon,
  MultiPolygon,
  Geometry,
  Feature,
  FeatureCollection
} from '@twinfile/geokit/core'

// Export geodrop-specific types
export type {
  ShapefileReader,
  ConversionOptions,
  CSVConversionOptions
} from './types/index.js'

// Shapefile utilities
export { shapefileToGeoJSON, shapefileToGeoJSONStream } from './shapefile/index.js'

// CSV utilities
export { csvH3ToGeoJSON, csvH3ToGeoJSONStream } from './csv/index.js'

// ZIP utilities
export { extractShapefileFromZip, extractCSVFromZip, analyzeZip } from './zip/index.js'
export type { ZipEntry, ZipAnalysis } from './zip/index.js'

// Utility functions
export { parseCSVLine, detectColumns, readCSVSamples } from './utils/index.js'
export type { DetectedColumns } from './utils/index.js'

// Convenience converter (auto-detects file type)
export { convertToGeoJSON, convertToGeoJSONStream } from './convert.js'

