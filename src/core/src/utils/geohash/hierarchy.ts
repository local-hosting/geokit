import { validateGeohash } from './validation';

const MAX_GEOHASH_PRECISION = 12;

export function geohashPrecision(hash: string): number {
  return hash.length;
}

export function geohashTruncate(hash: string, precision: number): string {
  if (!validateGeohash(hash)) {
    throw new Error(`Invalid geohash: ${hash}`);
  }
  if (!Number.isInteger(precision) || precision < 1 || precision > MAX_GEOHASH_PRECISION) {
    throw new Error(`Geohash precision must be an integer between 1 and ${MAX_GEOHASH_PRECISION}`);
  }
  if (precision > hash.length) {
    throw new Error(`Cannot truncate geohash ${hash} to precision ${precision}`);
  }
  return hash.slice(0, precision);
}

export function geohashParent(hash: string): string {
  if (!validateGeohash(hash)) {
    throw new Error(`Invalid geohash: ${hash}`);
  }
  if (hash.length <= 1) {
    throw new Error(`Geohash ${hash} has no parent`);
  }
  return hash.slice(0, hash.length - 1);
}
