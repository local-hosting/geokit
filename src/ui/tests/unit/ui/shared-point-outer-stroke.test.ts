/** @vitest-environment happy-dom */
import { describe, expect, it, vi } from 'vitest';
import { setupSharedPointOuterStrokeLayer } from '../../../src/utils/layers/styles/shared-point-layers';
import {
  SHARED_POINT_DEFAULT_GLOW_BLUR,
  SHARED_POINT_DEFAULT_GLOW_OPACITY,
  SHARED_POINT_FLOATING_BADGE_GLASS_BLUR,
  sharedPointGlassPaint,
  sharedPointZoomedOutStep,
  sampleZoomInterpolateValue,
  sharedPointFloatingBadgeOuterStrokeWidthExpression,
  sharedPointRadiusPlusStrokeWidth,
  sharedPointRestingOuterStrokeWidth,
} from '../../../src/utils/shared-point-paint';

describe('sharedPointGlassPaint', () => {
  it('is the shining-dot glow (key color, 2.5× dot) zoomed out, frosted glass zoomed in', () => {
    const pointRadius = ['interpolate', ['linear'], ['zoom'], 0, 2, 12, 9];
    const glassRadius = ['interpolate', ['linear'], ['zoom'], 0, 4, 12, 20];
    const paint = sharedPointGlassPaint({
      glassRadius,
      glassColor: '#soft',
      glowColor: '#key',
      pointRadius,
      ringWidth: 1,
    });
    expect(paint['circle-color']).toEqual(sharedPointZoomedOutStep('#key', '#soft'));
    expect(paint['circle-blur']).toEqual(
      sharedPointZoomedOutStep(SHARED_POINT_DEFAULT_GLOW_BLUR, SHARED_POINT_FLOATING_BADGE_GLASS_BLUR)
    );
    // Zoomed-out branch: resting glow opacity, brighter when hovered/selected.
    const zoomedOutOpacity = (paint['circle-opacity'] as unknown[])[2] as unknown[];
    expect(zoomedOutOpacity[zoomedOutOpacity.length - 1]).toBe(SHARED_POINT_DEFAULT_GLOW_OPACITY);
    const radius = paint['circle-radius'] as unknown[];
    expect(sampleZoomInterpolateValue(radius, 0)).toBeCloseTo((2 + 1) * 2.5);
    expect(sampleZoomInterpolateValue(radius, 12)).toBe(20);
  });
});

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
    // No white rim when zoomed out: width is 0 through z9, full curve from z10.
    const strokeWidth = spec.paint['circle-stroke-width'] as unknown[];
    expect(strokeWidth).toEqual(
      sharedPointRestingOuterStrokeWidth(sharedPointFloatingBadgeOuterStrokeWidthExpression(2.5))
    );
    expect(sampleZoomInterpolateValue(strokeWidth, 6)).toBe(0);
    expect(sampleZoomInterpolateValue(strokeWidth, 12)).toBeGreaterThan(0);
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
