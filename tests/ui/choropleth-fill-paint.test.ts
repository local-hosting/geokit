import { describe, expect, it } from 'vitest';
import { buildChoroplethFillPaint } from '../../src/ui/utils/choropleth-fill-paint';

describe('buildChoroplethFillPaint', () => {
  it('includes fill-antialias for flat product maps by default', () => {
    const paint = buildChoroplethFillPaint(null, {
      'fill-color': '#ff0000',
      'fill-opacity': 0.35,
    });
    expect(paint).toEqual({
      'fill-color': '#ff0000',
      'fill-opacity': 0.35,
      'fill-antialias': true,
    });
  });

  it('passes through outline color and respects antialias options', () => {
    const paint = buildChoroplethFillPaint(
      { getPitch: () => 0, getTerrain: () => null },
      {
        'fill-color': ['get', 'color'],
        'fill-opacity': 0.5,
        'fill-outline-color': 'transparent',
      },
      {}
    );
    expect(paint['fill-outline-color']).toBe('transparent');
    expect(paint['fill-antialias']).toBe(false);
  });
});
