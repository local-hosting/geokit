import { basename } from 'path'
import type { FeatureCollection } from '@local-hosting/geokit/core'
import { extractShapefileFromZip, extractCSVFromZip, analyzeZip } from './zip/index.js'
import { shapefileToGeoJSON, shapefileToGeoJSONStream } from './shapefile/index.js'
import { csvH3ToGeoJSON, csvH3ToGeoJSONStream } from './csv/index.js'
import type { ConversionOptions, CSVConversionOptions } from './types/index.js'
import type yauzl from 'yauzl'

/**
 * Auto-detect file type and convert to GeoJSON
 * Supports:
 * - .shp files (shapefiles)
 * - .zip files containing shapefiles
 * - .csv files with H3 hexagon IDs
 */
export async function convertToGeoJSON(
  filePath: string,
  options: {
    shapefile?: ConversionOptions
    csv?: CSVConversionOptions
    zip?: {
      tempDir?: string
    }
  } = {},
  dependencies: {
    openShapefile: (path: string) => Promise<{ read: () => Promise<{ done: boolean; value?: any }> }>
    yauzl: typeof yauzl
  }
): Promise<FeatureCollection> {
  const fileName = basename(filePath).toLowerCase()
  
  // Handle ZIP files
  if (fileName.endsWith('.zip')) {
    const tempDir = options.zip?.tempDir || `/tmp/geodrop-${Date.now()}`
    
    // First try shapefile
    const shpPath = await extractShapefileFromZip(filePath, tempDir, dependencies.yauzl)
    if (shpPath) {
      return shapefileToGeoJSON(shpPath, options.shapefile || {}, dependencies.openShapefile)
    }
    
    // Then try CSV
    const csvPath = await extractCSVFromZip(filePath, tempDir, dependencies.yauzl)
    if (csvPath) {
      return csvH3ToGeoJSON(csvPath, options.csv || {})
    }
    
    throw new Error('No shapefile or CSV found in ZIP archive')
  }
  
  // Handle shapefiles
  if (fileName.endsWith('.shp')) {
    return shapefileToGeoJSON(filePath, options.shapefile || {}, dependencies.openShapefile)
  }
  
  // Handle CSV files
  if (fileName.endsWith('.csv')) {
    return csvH3ToGeoJSON(filePath, options.csv || {})
  }
  
  throw new Error(`Unsupported file type: ${fileName}. Supported: .shp, .zip, .csv`)
}

/**
 * Auto-detect file type and stream GeoJSON features
 */
export async function* convertToGeoJSONStream(
  filePath: string,
  options: {
    shapefile?: ConversionOptions
    csv?: CSVConversionOptions
    zip?: {
      tempDir?: string
    }
  } = {},
  dependencies: {
    openShapefile: (path: string) => Promise<{ read: () => Promise<{ done: boolean; value?: any }> }>
    yauzl: typeof yauzl
  }
): AsyncGenerator<any, void, unknown> {
  const fileName = basename(filePath).toLowerCase()
  
  // Handle ZIP files
  if (fileName.endsWith('.zip')) {
    const tempDir = options.zip?.tempDir || `/tmp/geodrop-${Date.now()}`
    
    // First try shapefile
    const shpPath = await extractShapefileFromZip(filePath, tempDir, dependencies.yauzl)
    if (shpPath) {
      yield* shapefileToGeoJSONStream(shpPath, options.shapefile || {}, dependencies.openShapefile)
      return
    }
    
    // Then try CSV
    const csvPath = await extractCSVFromZip(filePath, tempDir, dependencies.yauzl)
    if (csvPath) {
      yield* csvH3ToGeoJSONStream(csvPath, options.csv || {})
      return
    }
    
    throw new Error('No shapefile or CSV found in ZIP archive')
  }
  
  // Handle shapefiles
  if (fileName.endsWith('.shp')) {
    yield* shapefileToGeoJSONStream(filePath, options.shapefile || {}, dependencies.openShapefile)
    return
  }
  
  // Handle CSV files
  if (fileName.endsWith('.csv')) {
    yield* csvH3ToGeoJSONStream(filePath, options.csv || {})
    return
  }
  
  throw new Error(`Unsupported file type: ${fileName}. Supported: .shp, .zip, .csv`)
}

