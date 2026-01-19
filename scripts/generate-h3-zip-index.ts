#!/usr/bin/env npx tsx
/**
 * Generate H3-to-ZIP Index
 *
 * Creates a mapping from H3 cells (resolution 5) to ZIP codes.
 * This enables instant ZIP code lookups without API calls.
 *
 * Data source: Census Bureau ZIP Code Tabulation Areas (ZCTAs)
 * https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2023_Gazetteer/
 *
 * Usage:
 *   npx tsx scripts/generate-h3-zip-index.ts
 *   npx tsx scripts/generate-h3-zip-index.ts --output ./data/zip-h3-index.json
 */

import { latLngToCell } from 'h3-js';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const H3_RESOLUTION = 5; // ~252 km² per cell, good balance of precision vs size

// Data source: GitHub Gist with US ZIP codes (CSV format)
const ZIP_DATA_URL =
  'https://gist.githubusercontent.com/erichurst/7882666/raw/5bdc46db47d9515269ab12ed6fb2850377fd869e/US%2520Zip%2520Codes%2520from%25202013%2520Government%2520Data';

interface ZipCentroid {
  zipcode: string;
  lat: number;
  lng: number;
}

/**
 * Fetch and parse ZIP centroids from CSV data source
 */
async function fetchZipCentroids(): Promise<ZipCentroid[]> {
  console.log('Fetching ZIP centroids...');
  console.log(`URL: ${ZIP_DATA_URL}`);

  const response = await fetch(ZIP_DATA_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`);
  }

  const text = await response.text();
  const lines = text.split('\n');

  // Skip header row (ZIP,LAT,LNG)
  const dataLines = lines.slice(1).filter((line) => line.trim());

  console.log(`Parsing ${dataLines.length} ZIP codes...`);

  const centroids: ZipCentroid[] = [];

  for (const line of dataLines) {
    // Format: ZIP,LAT,LNG (CSV)
    const parts = line.split(',');
    if (parts.length < 3) continue;

    const zipcode = parts[0].trim().padStart(5, '0');
    const lat = parseFloat(parts[1].trim());
    const lng = parseFloat(parts[2].trim());

    // Validate
    if (!zipcode || zipcode.length !== 5 || isNaN(lat) || isNaN(lng)) continue;
    if (lat < 17 || lat > 72 || lng < -180 || lng > -65) continue; // US bounds

    centroids.push({ zipcode, lat, lng });
  }

  console.log(`Parsed ${centroids.length} valid ZIP centroids`);
  return centroids;
}

/**
 * Generate H3-to-ZIP index from centroids
 */
function generateH3Index(centroids: ZipCentroid[]): Record<string, string[]> {
  console.log(`Generating H3 index at resolution ${H3_RESOLUTION}...`);

  const index: Record<string, string[]> = {};

  for (const { zipcode, lat, lng } of centroids) {
    try {
      const h3Cell = latLngToCell(lat, lng, H3_RESOLUTION);

      if (!index[h3Cell]) {
        index[h3Cell] = [];
      }
      index[h3Cell].push(zipcode);
    } catch (error) {
      // Skip invalid coordinates
    }
  }

  const cellCount = Object.keys(index).length;
  const avgZipsPerCell = (centroids.length / cellCount).toFixed(1);
  console.log(`Created index with ${cellCount} H3 cells (avg ${avgZipsPerCell} ZIPs/cell)`);

  return index;
}

/**
 * Write index to JSON file
 */
function writeIndex(index: Record<string, string[]>, outputPath: string): void {
  const dir = dirname(outputPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const json = JSON.stringify(index);
  const sizeKB = (Buffer.byteLength(json, 'utf8') / 1024).toFixed(1);

  writeFileSync(outputPath, json);
  console.log(`Wrote index to ${outputPath} (${sizeKB} KB)`);
}

/**
 * Main
 */
async function main() {
  const args = process.argv.slice(2);
  const outputIndex = args.indexOf('--output');
  const outputPath =
    outputIndex !== -1 && args[outputIndex + 1]
      ? resolve(args[outputIndex + 1])
      : resolve(__dirname, '../data/zip-h3-index.json');

  try {
    const centroids = await fetchZipCentroids();
    const index = generateH3Index(centroids);
    writeIndex(index, outputPath);

    console.log('\nIndex generated successfully!');
    console.log(`To use: loadH3ZipIndex(await fetch('${outputPath}').then(r => r.json()))`);
  } catch (error) {
    console.error('Error generating index:', error);
    process.exit(1);
  }
}

main();
