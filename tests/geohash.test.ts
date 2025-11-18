import { describe, it, expect } from 'vitest';
import {
  encodeGeohash,
  decodeGeohash,
  geohashBounds,
  geohashNeighbors,
  geohashNeighborsArray,
  geohashNeighbor,
  validateGeohash,
  geohashesInBounds,
} from '../src/geohash';

describe('geohash', () => {
  const nyc: [number, number] = [40.7128, -74.006];

  describe('encodeGeohash', () => {
    it('should encode coordinates to geohash', () => {
      const hash = encodeGeohash(nyc, 9);
      expect(hash).toBe('dr5regw3p');
    });

    it('should use default precision of 10', () => {
      const hash = encodeGeohash(nyc);
      expect(hash).toHaveLength(10);
    });

    it('should encode with different precisions', () => {
      const hash5 = encodeGeohash(nyc, 5);
      const hash10 = encodeGeohash(nyc, 10);
      expect(hash5).toHaveLength(5);
      expect(hash10).toHaveLength(10);
      expect(hash10.startsWith(hash5)).toBe(true);
    });
  });

  describe('decodeGeohash', () => {
    it('should decode geohash to coordinates', () => {
      const hash = 'dr5regw3p';
      const coords = decodeGeohash(hash);
      expect(coords[0]).toBeCloseTo(40.7128, 3);
      expect(coords[1]).toBeCloseTo(-74.006, 3);
    });

    it('should roundtrip encode/decode', () => {
      const hash = encodeGeohash(nyc, 9);
      const decoded = decodeGeohash(hash);
      expect(decoded[0]).toBeCloseTo(nyc[0], 3);
      expect(decoded[1]).toBeCloseTo(nyc[1], 3);
    });
  });

  describe('geohashBounds', () => {
    it('should return bounding box of geohash', () => {
      const hash = 'dr5r';
      const bounds = geohashBounds(hash);
      expect(bounds).toHaveLength(4);
      expect(bounds[0]).toBeLessThan(bounds[2]); // minLon < maxLon
      expect(bounds[1]).toBeLessThan(bounds[3]); // minLat < maxLat
    });

    it('should contain decoded center point', () => {
      const hash = 'dr5r';
      const bounds = geohashBounds(hash);
      const center = decodeGeohash(hash);
      expect(center[1]).toBeGreaterThanOrEqual(bounds[0]); // lon >= minLon
      expect(center[1]).toBeLessThanOrEqual(bounds[2]); // lon <= maxLon
      expect(center[0]).toBeGreaterThanOrEqual(bounds[1]); // lat >= minLat
      expect(center[0]).toBeLessThanOrEqual(bounds[3]); // lat <= maxLat
    });
  });

  describe('geohashNeighbors', () => {
    it('should return neighbors as object', () => {
      const hash = 'dr5r';
      const neighbors = geohashNeighbors(hash);
      expect(neighbors).toHaveProperty('n');
      expect(neighbors).toHaveProperty('ne');
      expect(neighbors).toHaveProperty('e');
      expect(neighbors).toHaveProperty('se');
      expect(neighbors).toHaveProperty('s');
      expect(neighbors).toHaveProperty('sw');
      expect(neighbors).toHaveProperty('w');
      expect(neighbors).toHaveProperty('nw');
      expect(typeof neighbors.n).toBe('string');
    });

    it('should return neighbors as array', () => {
      const hash = 'dr5r';
      const neighbors = geohashNeighborsArray(hash);
      expect(neighbors).toHaveLength(8);
      expect(neighbors.every((n) => typeof n === 'string')).toBe(true);
    });

    it('should get specific direction neighbor', () => {
      const hash = 'dr5r';
      const north = geohashNeighbor(hash, 'n');
      expect(typeof north).toBe('string');
      expect(north).toBe(geohashNeighbors(hash).n);
    });
  });

  describe('geohashesInBounds', () => {
    it('should return geohashes covering bounds', () => {
      const bounds: [number, number, number, number] = [-74.01, 40.7, -74.0, 40.71];
      const hashes = geohashesInBounds(bounds, 7);
      expect(Array.isArray(hashes)).toBe(true);
      expect(hashes.length).toBeGreaterThan(0);
    });
  });

  describe('validateGeohash', () => {
    it('should return true for valid geohash', () => {
      expect(validateGeohash('dr5regw3p')).toBe(true);
      expect(validateGeohash('ezs42')).toBe(true);
      expect(validateGeohash('dr5r')).toBe(true);
    });

    it('should return false for invalid geohash', () => {
      expect(validateGeohash('invalid!')).toBe(false); // Invalid character
      expect(validateGeohash('')).toBe(false); // Empty string
      expect(validateGeohash('aaa')).toBe(false); // 'a' not in base32 charset
      expect(validateGeohash('lio')).toBe(false); // 'i', 'l', 'o' not in base32 charset
    });
  });
});
