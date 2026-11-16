import { createReadStream, readFileSync, statSync } from 'fs'
import type { Feature, FeatureCollection, Polygon } from '@doppler-group/geokit/core'
import { h3ToPolygon, coordinatesToH3 } from '@doppler-group/geokit/h3'
import type { CSVConversionOptions } from '../types/index.js'
import { parseCSVLine } from '../utils/parse-csv.js'
import { detectColumns, readCSVSamples } from '../utils/detect-columns.js'

/**
 * Read CSV file with H3 hexagon IDs and convert to GeoJSON FeatureCollection
 * Supports both small files (read entirely) and large files (streamed)
 */
export async function csvH3ToGeoJSON(
  csvPath: string,
  options: CSVConversionOptions = {}
): Promise<FeatureCollection<Polygon>> {
  const features: Feature<Polygon>[] = []
  const h3Ids = new Set<string>()
  const h3Resolution = options.h3Resolution || 8
  
  const fileSize = statSync(csvPath).size
  const MAX_FILE_SIZE = 100 * 1024 * 1024 // 100MB
  
  // Auto-detect columns if not specified and auto-detection is enabled
  let h3Column = options.h3Column
  let latColumn = options.latColumn
  let lonColumn = options.lonColumn
  
  if (!options.disableAutoDetect && (!h3Column || !latColumn || !lonColumn)) {
    try {
      const { header, samples } = await readCSVSamples(csvPath, 10)
      const detected = detectColumns(header, samples)
      
      if (!h3Column && detected.h3Column) {
        h3Column = detected.h3Column
      }
      if (!latColumn && detected.latColumn) {
        latColumn = detected.latColumn
      }
      if (!lonColumn && detected.lonColumn) {
        lonColumn = detected.lonColumn
      }
    } catch (error) {
      // If auto-detection fails, continue with provided or default values
    }
  }
  
  // Fallback to default if still not set
  if (!h3Column && !latColumn && !lonColumn) {
    h3Column = 'h3_res8_id'
  }
  
  const processH3Id = (h3Id: string, properties: Record<string, any> = {}) => {
    if (h3Ids.has(h3Id)) return
    h3Ids.add(h3Id)
    
    const polygon = h3ToPolygon(h3Id)
    if (polygon) {
      // Apply filter if provided
      if (options.filter && !options.filter(properties)) {
        return
      }
      
      // Transform properties if provided
      const finalProperties = options.transformProperties 
        ? options.transformProperties(properties)
        : properties
      
      features.push({
        type: 'Feature',
        geometry: polygon,
        properties: finalProperties
      })
    }
  }
  
  const processLatLon = (lat: number, lon: number, properties: Record<string, any> = {}) => {
    try {
      const h3Id = coordinatesToH3(h3Resolution)([lat, lon])
      processH3Id(h3Id, properties)
    } catch (error) {
      // Skip invalid coordinates
    }
  }
  
  // Determine which columns to use
  const useH3 = !!h3Column
  const useLatLon = !!(latColumn && lonColumn)
  
  if (!useH3 && !useLatLon) {
    throw new Error('No H3 column or lat/lon columns found. Cannot convert CSV to GeoJSON.')
  }
  
  if (fileSize > MAX_FILE_SIZE) {
    // Stream for large files
    await new Promise<void>((resolve, reject) => {
      const stream = createReadStream(csvPath, { encoding: 'utf-8', highWaterMark: 64 * 1024 })
      let buffer = ''
      let header: string[] = []
      let h3IdIdx = -1
      let latIdx = -1
      let lonIdx = -1
      let isFirstLine = true
      
      stream.on('data', (chunk: string | Buffer) => {
        buffer += chunk.toString('utf-8')
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''
        
        for (const line of lines as string[]) {
          const trimmed = line.trim()
          if (!trimmed) continue
          
          if (isFirstLine) {
            header = parseCSVLine(trimmed)
            
            if (useH3 && h3Column) {
              h3IdIdx = header.indexOf(h3Column)
              if (h3IdIdx === -1) {
                stream.destroy()
                reject(new Error(`H3 column not found: ${h3Column}`))
                return
              }
            }
            
            if (useLatLon && latColumn && lonColumn) {
              latIdx = header.indexOf(latColumn)
              lonIdx = header.indexOf(lonColumn)
              if (latIdx === -1 || lonIdx === -1) {
                stream.destroy()
                reject(new Error(`Lat/lon columns not found: ${latColumn}, ${lonColumn}`))
                return
              }
            }
            
            isFirstLine = false
            continue
          }
          
          const fields = parseCSVLine(trimmed)
          
          // Build properties from CSV row
          const properties: Record<string, any> = {}
          header.forEach((col, idx) => {
            if (fields[idx]) {
              properties[col] = fields[idx]
            }
          })
          
          // Process H3 or lat/lon
          if (useH3 && h3IdIdx !== -1 && fields.length > h3IdIdx) {
            const h3Id = fields[h3IdIdx]?.trim()
            if (h3Id) {
              processH3Id(h3Id, properties)
            }
          } else if (useLatLon && latIdx !== -1 && lonIdx !== -1 && fields.length > Math.max(latIdx, lonIdx)) {
            const lat = parseFloat(fields[latIdx]?.trim())
            const lon = parseFloat(fields[lonIdx]?.trim())
            if (!isNaN(lat) && !isNaN(lon)) {
              processLatLon(lat, lon, properties)
            }
          }
        }
      })
      
      stream.on('end', () => {
        if (buffer.trim() && !isFirstLine) {
          const fields = parseCSVLine(buffer.trim())
          const properties: Record<string, any> = {}
          header.forEach((col, idx) => {
            if (fields[idx]) {
              properties[col] = fields[idx]
            }
          })
          
          if (useH3 && h3IdIdx !== -1 && fields.length > h3IdIdx) {
            const h3Id = fields[h3IdIdx]?.trim()
            if (h3Id) {
              processH3Id(h3Id, properties)
            }
          } else if (useLatLon && latIdx !== -1 && lonIdx !== -1 && fields.length > Math.max(latIdx, lonIdx)) {
            const lat = parseFloat(fields[latIdx]?.trim())
            const lon = parseFloat(fields[lonIdx]?.trim())
            if (!isNaN(lat) && !isNaN(lon)) {
              processLatLon(lat, lon, properties)
            }
          }
        }
        resolve()
      })
      
      stream.on('error', reject)
    })
  } else {
    // Read entire file for small files
    const content = readFileSync(csvPath, 'utf-8')
    const lines = content.split('\n').filter((line: string) => line.trim())
    
    if (lines.length === 0) {
      return { type: 'FeatureCollection', features: [] }
    }
    
    const header = parseCSVLine(lines[0])
    let h3IdIdx = -1
    let latIdx = -1
    let lonIdx = -1
    
    if (useH3 && h3Column) {
      h3IdIdx = header.indexOf(h3Column)
      if (h3IdIdx === -1) {
        throw new Error(`H3 column not found: ${h3Column}`)
      }
    }
    
    if (useLatLon && latColumn && lonColumn) {
      latIdx = header.indexOf(latColumn)
      lonIdx = header.indexOf(lonColumn)
      if (latIdx === -1 || lonIdx === -1) {
        throw new Error(`Lat/lon columns not found: ${latColumn}, ${lonColumn}`)
      }
    }
    
    for (let i = 1; i < lines.length; i++) {
      const fields = parseCSVLine(lines[i].trim())
      
      // Build properties from CSV row
      const properties: Record<string, any> = {}
      header.forEach((col, idx) => {
        if (fields[idx]) {
          properties[col] = fields[idx]
        }
      })
      
      // Process H3 or lat/lon
      if (useH3 && h3IdIdx !== -1 && fields.length > h3IdIdx) {
        const h3Id = fields[h3IdIdx]?.trim()
        if (h3Id) {
          processH3Id(h3Id, properties)
        }
      } else if (useLatLon && latIdx !== -1 && lonIdx !== -1 && fields.length > Math.max(latIdx, lonIdx)) {
        const lat = parseFloat(fields[latIdx]?.trim())
        const lon = parseFloat(fields[lonIdx]?.trim())
        if (!isNaN(lat) && !isNaN(lon)) {
          processLatLon(lat, lon, properties)
        }
      }
    }
  }
  
  return {
    type: 'FeatureCollection',
    features
  }
}

/**
 * Stream CSV file with H3 hexagon IDs and yield GeoJSON Features
 */
export async function* csvH3ToGeoJSONStream(
  csvPath: string,
  options: CSVConversionOptions = {}
): AsyncGenerator<Feature<Polygon>, void, unknown> {
  const h3Column = options.h3Column || 'h3_res8_id'
  const h3Ids = new Set<string>()
  
  const fileSize = statSync(csvPath).size
  const MAX_FILE_SIZE = 100 * 1024 * 1024 // 100MB
  
  const processH3Id = (h3Id: string, properties: Record<string, any> = {}): Feature<Polygon> | null => {
    if (h3Ids.has(h3Id)) return null
    h3Ids.add(h3Id)
    
    const polygon = h3ToPolygon(h3Id)
    if (!polygon) return null
    
    // Apply filter if provided
    if (options.filter && !options.filter(properties)) {
      return null
    }
    
    // Transform properties if provided
    const finalProperties = options.transformProperties 
      ? options.transformProperties(properties)
      : properties
    
    return {
      type: 'Feature',
      geometry: polygon,
      properties: finalProperties
    }
  }
  
  if (fileSize > MAX_FILE_SIZE) {
    // Stream for large files - use async generator with readable stream
    const stream = createReadStream(csvPath, { encoding: 'utf-8', highWaterMark: 64 * 1024 })
    let buffer = ''
    let header: string[] = []
    let h3IdIdx = -1
    let isFirstLine = true
    let streamEnded = false
    const pendingFeatures: Feature<Polygon>[] = []
    
    // Process stream data
    stream.on('data', (chunk: string | Buffer) => {
      buffer += chunk.toString('utf-8')
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''
      
      for (const line of lines as string[]) {
        const trimmed = line.trim()
        if (!trimmed) continue
        
        if (isFirstLine) {
          header = parseCSVLine(trimmed)
          h3IdIdx = header.indexOf(h3Column)
          
          if (h3IdIdx === -1) {
            stream.destroy()
            throw new Error(`Missing required CSV column: ${h3Column}`)
          }
          isFirstLine = false
          continue
        }
        
        const fields = parseCSVLine(trimmed)
        if (fields.length <= h3IdIdx) continue
        
        const h3Id = fields[h3IdIdx]?.trim()
        if (!h3Id) continue
        
        // Build properties from CSV row
        const properties: Record<string, any> = {}
        header.forEach((col, idx) => {
          if (fields[idx]) {
            properties[col] = fields[idx]
          }
        })
        
        const feature = processH3Id(h3Id, properties)
        if (feature) {
          pendingFeatures.push(feature)
        }
      }
    })
    
    // Wait for stream to end
    await new Promise<void>((resolve, reject) => {
      stream.on('end', () => {
        if (buffer.trim() && !isFirstLine) {
          const fields = parseCSVLine(buffer.trim())
          if (fields.length > h3IdIdx) {
            const h3Id = fields[h3IdIdx]?.trim()
            if (h3Id) {
              const properties: Record<string, any> = {}
              header.forEach((col, idx) => {
                if (fields[idx]) {
                  properties[col] = fields[idx]
                }
              })
              const feature = processH3Id(h3Id, properties)
              if (feature) {
                pendingFeatures.push(feature)
              }
            }
          }
        }
        streamEnded = true
        resolve()
      })
      stream.on('error', reject)
    })
    
    // Yield all pending features
    for (const feature of pendingFeatures) {
      yield feature
    }
  } else {
    // Read entire file for small files
    const content = readFileSync(csvPath, 'utf-8')
    const lines = content.split('\n').filter((line: string) => line.trim())
    
    if (lines.length === 0) {
      return
    }
    
    const header = parseCSVLine(lines[0])
    const h3IdIdx = header.indexOf(h3Column)
    
    if (h3IdIdx === -1) {
      throw new Error(`Missing required CSV column: ${h3Column}`)
    }
    
    for (let i = 1; i < lines.length; i++) {
      const fields = parseCSVLine(lines[i].trim())
      if (fields.length <= h3IdIdx) continue
      
      const h3Id = fields[h3IdIdx]?.trim()
      if (!h3Id) continue
      
      // Build properties from CSV row
      const properties: Record<string, any> = {}
      header.forEach((col, idx) => {
        if (fields[idx]) {
          properties[col] = fields[idx]
        }
      })
      
      const feature = processH3Id(h3Id, properties)
      if (feature) {
        yield feature
      }
    }
  }
}

