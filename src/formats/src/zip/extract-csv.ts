import { createWriteStream, mkdirSync, existsSync } from 'fs'
import { join, basename } from 'path'
import type yauzl from 'yauzl'

/**
 * Extract CSV file from a ZIP archive
 * Returns the path to the extracted CSV file, or null if not found
 * If multiple CSVs exist, extracts the first one (or specify fileName)
 */
export async function extractCSVFromZip(
  zipPath: string,
  tempDir: string,
  zipLib: typeof yauzl,
  fileName?: string
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

      let csvFile: string | null = null
      let foundTarget = false

      zipfile.readEntry()
      zipfile.on('entry', (entry: yauzl.Entry) => {
        if (/\/$/.test(entry.fileName)) {
          zipfile.readEntry()
          return
        }

        const entryFileName = basename(entry.fileName)
        const ext = entryFileName.substring(entryFileName.lastIndexOf('.')).toLowerCase()

        // Check if this is the target CSV
        const isTarget = fileName
          ? entry.fileName === fileName || entryFileName === fileName
          : ext === '.csv'

        if (isTarget && !foundTarget) {
          foundTarget = true
          zipfile.openReadStream(entry, (err, readStream) => {
            if (err) {
              zipfile.readEntry()
              return
            }

            const filePath = join(tempDir, entryFileName)
            const writeStream = createWriteStream(filePath)
            readStream.pipe(writeStream)

            readStream.on('end', () => {
              csvFile = filePath
              zipfile.close()
              resolve(csvFile)
            })

            writeStream.on('error', () => {
              zipfile.close()
              resolve(null)
            })
          })
        } else {
          zipfile.readEntry()
        }
      })

      zipfile.on('end', () => {
        if (!foundTarget) {
          resolve(null)
        }
      })

      zipfile.on('error', reject)
    })
  })
}

