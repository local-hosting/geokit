import { describe, it, expect } from 'vitest';
import {
  booleanAttributeChanged,
  parseBooleanAttribute,
} from '../../../src/components/boolean-attr';

describe('parseBooleanAttribute', () => {
  it('uses defaultWhenAbsent when attribute is missing', () => {
    expect(parseBooleanAttribute(null, true)).toBe(true);
    expect(parseBooleanAttribute(null, false)).toBe(false);
    expect(parseBooleanAttribute(undefined, true)).toBe(true);
  });

  it('default-true: only explicit false turns off', () => {
    expect(parseBooleanAttribute('false', true)).toBe(false);
    expect(parseBooleanAttribute('true', true)).toBe(true);
    expect(parseBooleanAttribute('', true)).toBe(true);
    expect(parseBooleanAttribute('0', true)).toBe(true);
  });

  it('default-false: true only for "true" or empty present attr', () => {
    expect(parseBooleanAttribute('true', false)).toBe(true);
    expect(parseBooleanAttribute('', false)).toBe(true);
    expect(parseBooleanAttribute('false', false)).toBe(false);
    expect(parseBooleanAttribute('yes', false)).toBe(false);
  });
});

describe('booleanAttributeChanged', () => {
  it('ignores equivalent default-true spellings', () => {
    expect(booleanAttributeChanged(null, 'true', true)).toBe(false);
    expect(booleanAttributeChanged('', 'true', true)).toBe(false);
    expect(booleanAttributeChanged('true', 'false', true)).toBe(true);
  });

  it('detects default-false changes including empty present', () => {
    expect(booleanAttributeChanged(null, '', false)).toBe(true);
    expect(booleanAttributeChanged(null, 'false', false)).toBe(false);
    expect(booleanAttributeChanged('false', 'true', false)).toBe(true);
  });
});
