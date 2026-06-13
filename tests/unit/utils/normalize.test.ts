import { describe, it, expect } from 'vitest';
import { slugify, normalize, normalizeName } from '../../../src/utils/normalize';

describe('normalize', () => {
  describe('slugify', () => {
    it('should convert text to URL-safe slug', () => {
      expect(slugify('New York City')).toBe('new-york-city');
      expect(slugify('Los Angeles, CA')).toBe('los-angeles-ca');
      expect(slugify('San Francisco-Oakland-San Jose')).toBe('san-francisco-oakland-san-jose');
    });

    it('should handle special characters', () => {
      expect(slugify('Test & Example')).toBe('test-example');
      expect(slugify('Hello@World#123')).toBe('helloworld123');
    });

    it('should handle empty strings', () => {
      expect(slugify('')).toBe('');
      expect(slugify('   ')).toBe('');
    });

    it('should remove leading/trailing hyphens', () => {
      expect(slugify('---test---')).toBe('test');
    });
  });

  describe('normalize', () => {
    it('should normalize text for comparison', () => {
      expect(normalize('New York City')).toBe('new york city');
      expect(normalize('Los Angeles, CA')).toBe('los angeles ca');
    });

    it('should remove special characters', () => {
      expect(normalize('Test & Example')).toBe('test example');
      expect(normalize('Hello@World#123')).toBe('hello world 123');
    });

    it('should normalize whitespace', () => {
      expect(normalize('  multiple   spaces  ')).toBe('multiple spaces');
    });

    it('should handle empty strings', () => {
      expect(normalize('')).toBe('');
    });
  });

  describe('normalizeName', () => {
    it('should normalize geographic names', () => {
      expect(normalizeName('Ft. Worth')).toBe('fort worth');
      expect(normalizeName('St. Louis')).toBe('saint louis');
      expect(normalizeName('New York & Company')).toBe('new york and company');
    });

    it('should expand abbreviations', () => {
      expect(normalizeName('Ft. Myers')).toBe('fort myers');
      expect(normalizeName('St. Paul')).toBe('saint paul');
    });

    it('should handle HTML entities', () => {
      expect(normalizeName('Test &amp; Example')).toBe('test and example');
    });

    it('should handle empty strings', () => {
      expect(normalizeName('')).toBe('');
    });
  });
});
