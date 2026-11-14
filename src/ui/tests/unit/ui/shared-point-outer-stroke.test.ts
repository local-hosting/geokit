/** @vitest-environment happy-dom */
import { describe, expect, it, vi } from 'vitest';
import { setupSharedPointOuterStrokeLayer } from '../../../src/utils/layers/styles/shared-point-layers';
import {
  sharedPointFloatingBadgeOuterStrokeWidthExpression,
  sharedPointRadiusPlusStrokeWidth,
} from '../../../src/utils/shared-point-paint';

describe('setupSharedPointOuterStrokeLayer', () => {
  it('creates the white outer stroke with a MapLibre-safe merged radius (not + of two interpolates)', () => {
    const addLayer = vi.fn();
    const map = {
      getLayer: vi.fn((id: string) => (id === 'venues-point' ? {} : undefined)),
      addLayer,
    };
    const pointRadius = ['interpolate', ['linear'], ['zoom'], 10, 6, 16, 20];
    const coloredStrokeWidth = ['interpolate', ['linear'], ['zoom'], 10, 4, 16, 7];

    setupSharedPointOuterStrokeLayer(map as never, 'venues', 'venues-point', {
      pointRadius,
      coloredStrokeWidth,
      outerStrokeWidth: sharedPointFloatingBadgeOuterStrokeWidthExpression(2.5),
      outerStrokeColor: '#ffffff',
      outerStrokeOpacity: 0.95,
    });

    expect(addLayer).toHaveBeenCalledTimes(1);
    const spec = addLayer.mock.calls[0]?.[0] as {
      id: string;
      paint: Record<string, unknown>;
    };
    expect(spec.id).toBe('venues-point-outer-stroke');
    expect(spec.paint['circle-stroke-color']).toBe('#ffffff');
    expect(spec.paint['circle-stroke-width']).toEqual(
      sharedPointFloatingBadgeOuterStrokeWidthExpression(2.5)
    );
    // MapLibre rejects `['+', interpolate, interpolate]` for circle-radius — merge stops.
    const radius = spec.paint['circle-radius'] as unknown[];
    expect(radius[0]).toBe('interpolate');
    expect(radius).not.toContain('+');
    expect(radius).toEqual(sharedPointRadiusPlusStrokeWidth(pointRadius, coloredStrokeWidth));
    // z10: 6+4=10, z16: 20+7=27
    expect(radius[radius.indexOf(10) + 1]).toBe(10);
    expect(radius[radius.indexOf(16) + 1]).toBe(27);
  });
});
