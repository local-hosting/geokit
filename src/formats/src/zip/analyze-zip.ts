import { basename } from 'path'
import type yauzl from 'yauzl'

export interface ZipEntry {
  fileName: string
  uncompressedSize: number
  compressedSize: number
  isDirectory: boolean
}

export interface ZipAnalysis {
  entries: ZipEntry[]
  hasShapefile: boolean
  hasCSV: boolean
  shapefileEntries: string[]
  csvEntries: string[]
  totalSize: number
  compressedSize: number
}

/**
 * Analyze ZIP file contents without extracting
 */
export async function analyzeZip(
  zipPath: string,
  zipLib: typeof yauzl
): Promise<ZipAnalysis> {
  return new Promise((resolve, reject) => {
    zipLib.open(zipPath, { lazyEntries: true }, (err, zipfile) => {
      if (err) {
        reject(err)
        return
      }

      const entries: ZipEntry[] = []
      const shapefileEntries: string[] = []
      const csvEntries: string[] = []
      let totalSize = 0
      let compressedSize = 0

      zipfile.readEntry()
      zipfile.on('entry', (entry: yauzl.Entry) => {
        const isDirectory = /\/$/.test(entry.fileName)
        const fileName = basename(entry.fileName)
        const ext = fileName.substring(fileName.lastIndexOf('.')).toLowerCase()

        entries.push({
          fileName: entry.fileName,
          uncompressedSize: entry.uncompressedSize,
          compressedSize: entry.compressedSize,
          isDirectory
        })

        if (!isDirectory) {
          totalSize += entry.uncompressedSize
          compressedSize += entry.compressedSize

          if (ext === '.shp' || ext === '.shx' || ext === '.dbf') {
            if (!shapefileEntries.includes(entry.fileName)) {
              shapefileEntries.push(entry.fileName)
            }
          } else if (ext === '.csv') {
            csvEntries.push(entry.fileName)
          }
        }

        zipfile.readEntry()
      })

      zipfile.on('end', () => {
        resolve({
          entries,
          hasShapefile: shapefileEntries.length >= 3, // Need .shp, .shx, .dbf
          hasCSV: csvEntries.length > 0,
          shapefileEntries,
          csvEntries,
          totalSize,
          compressedSize
        })
      })

      zipfile.on('error', reject)
    })
  })
}

