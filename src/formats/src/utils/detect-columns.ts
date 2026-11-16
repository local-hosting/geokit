import { validateH3 } from '@local-hosting/geokit/h3';
import { normalizeLatitude, normalizeLongitude } from '@local-hosting/geokit/core'
import { parseCSVLine } from './parse-csv.js'

export interface DetectedColumns {
  h3Column?: string
  latColumn?: string
  lonColumn?: string
}

/**
 * Detect if a string looks like an H3 hexagon ID
 */
function looksLikeH3(value: string): boolean {
  // H3 IDs are typically 15-character hexadecimal strings
  // They can be shorter for lower resolutions
  const trimmed = value.trim()
  if (!trimmed) return false
  
  // Check if it's a valid H3 ID using geokit
  try {
    return validateH3(trimmed)
  } catch {
    return false
  }
}

/**
 * Detect if a string looks like a latitude value
 * Requires decimal point and valid range (uses @geokit for normalization)
 */
function looksLikeLatitude(value: string): boolean {
  const num = parseFloat(value)
  if (isNaN(num)) return false
  // Must have decimal point AND normalize to valid range
  if (!value.includes('.')) return false
  try {
    const normalized = normalizeLatitude(num)
    // If normalization changed the value significantly, it was out of range
    return Math.abs(normalized - num) < 0.0001 && normalized >= -90 && normalized <= 90
  } catch {
    return false
  }
}

/**
 * Detect if a string looks like a longitude value
 * Requires decimal point and valid range (uses @geokit for normalization)
 */
function looksLikeLongitude(value: string): boolean {
  const num = parseFloat(value)
  if (isNaN(num)) return false
  // Must have decimal point AND normalize to valid range
  if (!value.includes('.')) return false
  try {
    const normalized = normalizeLongitude(num)
    // If normalization changed the value significantly, it was out of range
    // (but longitude can wrap, so we check if it's in reasonable range)
    return normalized >= -180 && normalized <= 180
  } catch {
    return false
  }
}

/**
 * Check if a column name suggests it contains H3, lat, or lon data
 */
function columnNameSuggestsType(columnName: string): 'h3' | 'lat' | 'lon' | null {
  const lower = columnName.toLowerCase()
  
  // H3 patterns
  if (lower.includes('h3') || lower.includes('hex') || lower.includes('cell')) {
    return 'h3'
  }
  
  // Check for combined lat/lng patterns (lat_lng, latlng, etc.)
  const hasLat = lower.includes('lat') || lower.includes('latitude')
  const hasLng = lower.includes('lon') || lower.includes('lng') || lower.includes('longitude')
  
  if (hasLat && hasLng) {
    // Combined column - could be either, but prefer lat for detection
    // In practice, we'd need to parse this differently, but for now detect as lat
    return 'lat'
  }
  
  // Latitude patterns
  if (hasLat || lower === 'y') {
    return 'lat'
  }
  
  // Longitude patterns
  if (hasLng || lower === 'x') {
    return 'lon'
  }
  
  return null
}

/**
 * Auto-detect H3, latitude, and longitude columns from CSV header and sample rows
 */
export function detectColumns(
  header: string[],
  sampleRows: string[][],
  maxSamples: number = 10
): DetectedColumns {
  const detected: DetectedColumns = {}
  
  // Analyze each column
  for (let colIdx = 0; colIdx < header.length; colIdx++) {
    const columnName = header[colIdx]
    const samples = sampleRows
      .map(row => row[colIdx]?.trim())
      .filter(val => val !== undefined && val !== '')
      .slice(0, maxSamples)
    
    if (samples.length === 0) continue
    
    // Check column name first
    const nameSuggestion = columnNameSuggestsType(columnName)
    
    // Check H3
    if (!detected.h3Column) {
      const h3Matches = nameSuggestion === 'h3' 
        ? samples.filter(looksLikeH3).length
        : samples.filter(looksLikeH3).length
      
      // If name suggests H3 or most samples look like H3
      if (nameSuggestion === 'h3' || (h3Matches / samples.length) >= 0.8) {
        detected.h3Column = columnName
        continue
      }
    }
    
    // Check latitude (by column name first, then by data values)
    if (!detected.latColumn) {
      if (nameSuggestion === 'lat') {
        // Check if this column name contains both lat and lng together
        const lower = columnName.toLowerCase()
        const hasBoth = (lower.includes('lat') && (lower.includes('lon') || lower.includes('lng')))
        
        // Verify values have decimal points
        const hasDecimals = samples.some(val => val.includes('.'))
        if (hasDecimals) {
          detected.latColumn = columnName
          // If it's a combined column, also try to find the corresponding lon column
          if (hasBoth) {
            // Look for a separate lon column in the header
            for (let otherIdx = 0; otherIdx < header.length; otherIdx++) {
              if (otherIdx === colIdx) continue
              const otherName = header[otherIdx].toLowerCase()
              if ((otherName.includes('lon') || otherName.includes('lng') || otherName.includes('longitude')) 
                  && !otherName.includes('lat') && !otherName.includes('latitude')) {
                detected.lonColumn = header[otherIdx]
                break
              }
            }
          }
          continue
        }
      } else {
        // Try data-based detection if column name doesn't suggest lat
        const latMatches = samples.filter(looksLikeLatitude).length
        if (latMatches / samples.length >= 0.8 && samples.length >= 3) {
          detected.latColumn = columnName
          continue
        }
      }
    }
    
    // Check longitude (by column name first, then by data values)
    if (!detected.lonColumn) {
      if (nameSuggestion === 'lon') {
        // Verify values have decimal points
        const hasDecimals = samples.some(val => val.includes('.'))
        if (hasDecimals) {
          detected.lonColumn = columnName
          continue
        }
      } else {
        // Try data-based detection if column name doesn't suggest lon
        const lonMatches = samples.filter(looksLikeLongitude).length
        if (lonMatches / samples.length >= 0.8 && samples.length >= 3) {
          detected.lonColumn = columnName
          continue
        }
      }
    }
  }
  
  return detected
}

/**
 * Read CSV header and sample rows for column detection
 */
export async function readCSVSamples(
  csvPath: string,
  maxSamples: number = 10
): Promise<{ header: string[]; samples: string[][] }> {
  const { readFileSync, createReadStream, statSync } = await import('fs')
  const fileSize = statSync(csvPath).size
  const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB for sampling
  
  if (fileSize > MAX_FILE_SIZE) {
    // Stream first chunk
    return new Promise((resolve, reject) => {
      const stream = createReadStream(csvPath, { encoding: 'utf-8', highWaterMark: 64 * 1024 })
      let buffer = ''
      let header: string[] | null = null
      const samples: string[][] = []
      
      stream.on('data', (chunk: string | Buffer) => {
        buffer += chunk.toString('utf-8')
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''
        
        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed) continue
          
          if (!header) {
            header = parseCSVLine(trimmed)
            continue
          }
          
          if (samples.length < maxSamples) {
            samples.push(parseCSVLine(trimmed))
          } else {
            stream.destroy()
            resolve({ header, samples })
            return
          }
        }
      })
      
      stream.on('end', () => {
        if (header) {
          resolve({ header, samples })
        } else {
          reject(new Error('Could not read CSV header'))
        }
      })
      
      stream.on('error', reject)
    })
  } else {
    // Read entire file
    const content = readFileSync(csvPath, 'utf-8')
    const lines = content.split('\n').filter((line: string) => line.trim())
    
    if (lines.length === 0) {
      throw new Error('CSV file is empty')
    }
    
    const header = parseCSVLine(lines[0])
    const samples = lines
      .slice(1, maxSamples + 1)
      .map(line => parseCSVLine(line.trim()))
    
    return { header, samples }
  }
}

