import type { Feature, FeatureCollection } from '@local-hosting/geokit/core'
import type { ConversionOptions } from '../types/index.js'

/**
 * Read a shapefile and convert to GeoJSON FeatureCollection
 */
export async function shapefileToGeoJSON(
  shpPath: string,
  options: ConversionOptions = {},
  openShapefile: (path: string) => Promise<{ read: () => Promise<{ done: boolean; value?: Feature }> }>
): Promise<FeatureCollection> {
  const features: Feature[] = []
  
  try {
    const source = await openShapefile(shpPath)
    let result = await source.read()
    
    while (!result.done) {
      const feature = result.value
      if (feature) {
        // Apply filter if provided
        if (options.filter && !options.filter(feature.properties || {})) {
          result = await source.read()
          continue
        }
        
        // Transform properties if provided
        if (options.transformProperties) {
          feature.properties = options.transformProperties(feature.properties || {})
        }
        
        // Transform geometry if provided
        if (options.transformGeometry && feature.geometry) {
          const transformed = options.transformGeometry(feature.geometry)
          if (transformed) {
            feature.geometry = transformed
            features.push(feature)
          }
        } else if (feature.geometry) {
          features.push(feature)
        }
      }
      
      result = await source.read()
    }
  } catch (error: any) {
    throw new Error(`Error reading shapefile: ${error.message}`)
  }
  
  return {
    type: 'FeatureCollection',
    features
  }
}

/**
 * Read shapefile features one at a time (for streaming/large files)
 */
export async function* shapefileToGeoJSONStream(
  shpPath: string,
  options: ConversionOptions = {},
  openShapefile: (path: string) => Promise<{ read: () => Promise<{ done: boolean; value?: Feature }> }>
): AsyncGenerator<Feature, void, unknown> {
  try {
    const source = await openShapefile(shpPath)
    let result = await source.read()
    
    while (!result.done) {
      const feature = result.value
      if (feature) {
        // Apply filter if provided
        if (options.filter && !options.filter(feature.properties || {})) {
          result = await source.read()
          continue
        }
        
        // Transform properties if provided
        if (options.transformProperties) {
          feature.properties = options.transformProperties(feature.properties || {})
        }
        
        // Transform geometry if provided
        if (options.transformGeometry && feature.geometry) {
          const transformed = options.transformGeometry(feature.geometry)
          if (transformed) {
            feature.geometry = transformed
            yield feature
          }
        } else if (feature.geometry) {
          yield feature
        }
      }
      
      result = await source.read()
    }
  } catch (error: any) {
    throw new Error(`Error reading shapefile: ${error.message}`)
  }
}

