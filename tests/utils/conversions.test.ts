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

  describe('edge cases', () => {
    describe('DMS edge cases', () => {
      it('should handle 0 degrees', () => {
        const dms = toDMS(0, false);
        expect(dms.degrees).toBe(0);
        expect(dms.minutes).toBe(0);
        expect(dms.seconds).toBe(0);
      });

      it('should handle 90 degrees latitude', () => {
        const dms = toDMS(90, false);
        expect(dms.degrees).toBe(90);
        expect(dms.direction).toBe('N');
      });

      it('should handle -90 degrees latitude', () => {
        const dms = toDMS(-90, false);
        expect(dms.degrees).toBe(90);
        expect(dms.direction).toBe('S');
      });

      it('should handle 180 degrees longitude', () => {
        const dms = toDMS(180, true);
        expect(dms.degrees).toBe(180);
        expect(dms.direction).toBe('E');
      });

      it('should handle -180 degrees longitude', () => {
        const dms = toDMS(-180, true);
        expect(dms.degrees).toBe(180);
        expect(dms.direction).toBe('W');
      });

      it('should handle fractional seconds', () => {
        const dms = toDMS(40.123456, false);
        expect(dms.degrees).toBe(40);
        expect(dms.minutes).toBeGreaterThan(0);
        expect(dms.seconds).toBeGreaterThan(0);
      });

      it('should round-trip correctly', () => {
        const original = 40.7128;
        const dms = toDMS(original, false);
        const converted = fromDMS(dms);
        expect(converted).toBeCloseTo(original, 4);
      });

      it('should handle south direction', () => {
        const dms = { degrees: 40, minutes: 42, seconds: 46.08, direction: 'S' as const };
        const decimal = fromDMS(dms);
        expect(decimal).toBeCloseTo(-40.7128, 4);
      });

      it('should handle west direction', () => {
        const dms = { degrees: 74, minutes: 0, seconds: 21.6, direction: 'W' as const };
        const decimal = fromDMS(dms);
        expect(decimal).toBeCloseTo(-74.006, 4);
      });

      it('should handle east direction', () => {
        const dms = { degrees: 74, minutes: 0, seconds: 21.6, direction: 'E' as const };
        const decimal = fromDMS(dms);
        expect(decimal).toBeCloseTo(74.006, 4);
      });

      it('should format DMS with seconds', () => {
        const dms = { degrees: 40, minutes: 42, seconds: 46, direction: 'N' as const };
        const formatted = formatDMS(dms);
        expect(formatted).toContain('40°');
        expect(formatted).toContain("42'");
        expect(formatted).toContain('46'); // May include decimal places
      });

      it('should format DMS for coordinates at equator', () => {
        const dms = coordinatesToDMS(0, 0);
        expect(dms.latitude.direction).toBe('N');
        expect(dms.longitude.direction).toBe('E');
      });
    });

    describe('angle conversion edge cases', () => {
      it('should handle 360 degrees', () => {
        const rad = toRadians(360);
        expect(rad).toBeCloseTo(2 * Math.PI, 10);
      });

      it('should handle negative angles', () => {
        const rad = toRadians(-90);
        expect(rad).toBeCloseTo(-Math.PI / 2, 10);
      });

      it('should handle 2PI radians', () => {
        const deg = toDegrees(2 * Math.PI);
        expect(deg).toBeCloseTo(360, 10);
      });

      it('should handle negative radians', () => {
        const deg = toDegrees(-Math.PI);
        expect(deg).toBeCloseTo(-180, 10);
      });

      it('should handle very small angles', () => {
        const rad = toRadians(0.0001);
        expect(rad).toBeCloseTo(0.00000174533, 10);
      });

      it('should handle very large angles', () => {
        const rad = toRadians(720); // 2 full rotations
        expect(rad).toBeCloseTo(4 * Math.PI, 10);
      });
    });

    describe('normalization edge cases', () => {
      it('should handle 180 longitude', () => {
        const normalized = normalizeLongitude(180);
        // 180 and -180 are equivalent on the antimeridian
        expect(Math.abs(normalized)).toBeCloseTo(180, 5);
      });

      it('should handle -180 longitude', () => {
        const normalized = normalizeLongitude(-180);
        expect(Math.abs(normalized)).toBeCloseTo(180, 5);
      });

      it('should handle multiple wraps positive', () => {
        const normalized = normalizeLongitude(900);
        // 900 % 360 = 180, which wraps to -180
        expect(Math.abs(normalized)).toBeCloseTo(180, 5);
      });

      it('should handle multiple wraps negative', () => {
        expect(normalizeLongitude(-900)).toBeCloseTo(-180, 5);
      });

      it('should handle 90 latitude', () => {
        expect(normalizeLatitude(90)).toBe(90);
      });

      it('should handle -90 latitude', () => {
        expect(normalizeLatitude(-90)).toBe(-90);
      });

      it('should handle very large positive latitude', () => {
        expect(normalizeLatitude(1000)).toBe(90);
      });

      it('should handle very large negative latitude', () => {
        expect(normalizeLatitude(-1000)).toBe(-90);
      });

      it('should normalize coordinates at poles', () => {
        const normalized = normalizeCoordinates([91, 0]);
        expect(normalized[0]).toBe(90);
        expect(normalized[1]).toBe(0);
      });

      it('should normalize coordinates at antimeridian', () => {
        const normalized = normalizeCoordinates([0, 181]);
        expect(normalized[0]).toBe(0);
        expect(normalized[1]).toBeCloseTo(-179, 5);
      });

      it('should handle zero coordinates', () => {
        const normalized = normalizeCoordinates([0, 0]);
        expect(normalized[0]).toBe(0);
        expect(normalized[1]).toBe(0);
      });

      it('should normalize extreme coordinates', () => {
        const normalized = normalizeCoordinates([100, 190]);
        expect(normalized[0]).toBe(90);
        expect(normalized[1]).toBeCloseTo(-170, 5);
      });
    });
  });
});
