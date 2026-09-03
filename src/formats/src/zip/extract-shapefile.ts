import { createWriteStream, mkdirSync, existsSync } from 'fs'
import { join, basename } from 'path'
import type yauzl from 'yauzl'

/**
 * Extract shapefile components (.shp, .shx, .dbf) from a ZIP file
 * Returns the path to the extracted .shp file, or null if not found
 */
export async function extractShapefileFromZip(
  zipPath: string,
  tempDir: string,
  zipLib: typeof yauzl
): Promise<string | null> {
  return new Promise((resolve, reject) => {
    if (!existsSync(tempDir)) {
      mkdirSync(tempDir, { recursive: true })
    }
    
    zipLib.open(zipPath, { lazyEntries: true }, (err, zipfile) => {
      if (err) {
        reject(err)
        return
      }
      
      let shpFile: string | null = null
      const requiredExts = ['.shp', '.shx', '.dbf']
      const extractedFiles: string[] = []
      let pendingExtractions = 0
      
      zipfile.readEntry()
      zipfile.on('entry', (entry: yauzl.Entry) => {
        if (/\/$/.test(entry.fileName)) {
          zipfile.readEntry()
          return
        }
        
        const fileName = basename(entry.fileName)
        const ext = fileName.substring(fileName.lastIndexOf('.'))
        
        // Only extract shapefile components
        if (requiredExts.includes(ext.toLowerCase())) {
          pendingExtractions++
          zipfile.openReadStream(entry, (err, readStream) => {
            if (err) {
              pendingExtractions--
              zipfile.readEntry()
              return
            }

            const filePath = join(tempDir, fileName)
            const writeStream = createWriteStream(filePath)
            readStream.pipe(writeStream)

            readStream.on('end', () => {
              extractedFiles.push(filePath)
              if (ext.toLowerCase() === '.shp') {
                shpFile = filePath
              }
              pendingExtractions--
            })

            writeStream.on('error', () => {
              pendingExtractions--
            })

            zipfile.readEntry()
          })
        } else {
          zipfile.readEntry()
        }
      })

      zipfile.on('end', () => {
        if (pendingExtractions === 0) {
          resolve(shpFile)
        } else {
          const wait = () => {
            if (pendingExtractions === 0) {
              resolve(shpFile)
            } else {
              setImmediate(wait)
            }
          }
          wait()
        }
      })
      
      zipfile.on('error', reject)
    })
  })
}

