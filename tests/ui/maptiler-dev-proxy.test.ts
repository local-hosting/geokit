import { describe, expect, it } from 'vitest';
import { rewriteMapTilerUrl } from '../../src/ui/dev-proxy/maptiler-dev-proxy';

describe('rewriteMapTilerUrl', () => {
  it('rewrites api and cdn URLs when enabled', () => {
    const options = { enabled: true };
    expect(
      rewriteMapTilerUrl('https://api.maptiler.com/maps/basic/style.json?key=x', options)
    ).toBe('/__maptiler-api/maps/basic/style.json?key=x');
    expect(rewriteMapTilerUrl('https://cdn.maptiler.com/foo', options)).toBe('/__maptiler-cdn/foo');
  });

  it('passes through when disabled', () => {
    const url = 'https://api.maptiler.com/tiles.json';
    expect(rewriteMapTilerUrl(url, { enabled: false })).toBe(url);
  });
});
