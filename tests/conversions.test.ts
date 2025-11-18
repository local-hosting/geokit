import { describe, it, expect } from 'vitest';
import {
  toDMS,
  fromDMS,
  coordinatesToDMS,
  formatDMS,
  toRadians,
  toDegrees,
  normalizeLongitude,
  normalizeLatitude,
  normalizeCoordinates,
} from '../src/conversions';

describe('conversions', () => {
  describe('DMS conversions', () => {
    it('should convert decimal to DMS for latitude', () => {
      const dms = toDMS(40.7128, false);
      expect(dms.degrees).toBe(40);
      expect(dms.minutes).toBe(42);
      expect(dms.seconds).toBeCloseTo(46.08, 1);
      expect(dms.direction).toBe('N');
    });

    it('should convert negative latitude to DMS', () => {
      const dms = toDMS(-40.7128, false);
      expect(dms.direction).toBe('S');
      expect(dms.degrees).toBe(40);
    });

    it('should convert decimal to DMS for longitude', () => {
      const dms = toDMS(-74.006, true);
      expect(dms.degrees).toBe(74);
      expect(dms.minutes).toBe(0);
      expect(dms.seconds).toBeCloseTo(21.6, 1);
      expect(dms.direction).toBe('W');
    });

    it('should convert DMS back to decimal', () => {
      const dms = { degrees: 40, minutes: 42, seconds: 46.08, direction: 'N' as const };
      const decimal = fromDMS(dms);
      expect(decimal).toBeCloseTo(40.7128, 4);
    });

    it('should handle coordinate pair conversion', () => {
      const dms = coordinatesToDMS(40.7128, -74.006);
      expect(dms.latitude.direction).toBe('N');
      expect(dms.longitude.direction).toBe('W');
    });

    it('should format DMS as string', () => {
      const dms = { degrees: 40, minutes: 42, seconds: 46.08, direction: 'N' as const };
      const formatted = formatDMS(dms);
      expect(formatted).toContain('40°');
      expect(formatted).toContain("42'");
      expect(formatted).toContain('N');
    });
  });

  describe('angle conversions', () => {
    it('should convert degrees to radians', () => {
      const rad = toRadians(180);
      expect(rad).toBeCloseTo(Math.PI, 10);
    });

    it('should convert radians to degrees', () => {
      const deg = toDegrees(Math.PI);
      expect(deg).toBeCloseTo(180, 10);
    });

    it('should handle zero', () => {
      expect(toRadians(0)).toBe(0);
      expect(toDegrees(0)).toBe(0);
    });
  });

  describe('coordinate normalization', () => {
    it('should normalize longitude to -180 to 180', () => {
      expect(normalizeLongitude(190)).toBeCloseTo(-170, 5);
      expect(normalizeLongitude(-190)).toBeCloseTo(170, 5);
      expect(normalizeLongitude(360)).toBeCloseTo(0, 5);
    });

    it('should clamp latitude to -90 to 90', () => {
      expect(normalizeLatitude(95)).toBe(90);
      expect(normalizeLatitude(-95)).toBe(-90);
      expect(normalizeLatitude(45)).toBe(45);
    });

    it('should normalize coordinate pairs', () => {
      const normalized = normalizeCoordinates([95, 190]);
      expect(normalized[0]).toBe(90);
      expect(normalized[1]).toBeCloseTo(-170, 5);
    });

    it('should not change valid coordinates', () => {
      const coords: [number, number] = [40.7128, -74.006];
      const normalized = normalizeCoordinates(coords);
      expect(normalized[0]).toBeCloseTo(coords[0], 5);
      expect(normalized[1]).toBeCloseTo(coords[1], 5);
    });
  });
});
