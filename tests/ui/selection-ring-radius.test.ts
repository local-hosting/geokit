import { describe, expect, it } from 'vitest';
import {
  getGlowRadiusInterpolation,
  getHoverGlowRadiusInterpolation,
  getPointRadiusInterpolation,
  getSelectionRingRadiusInterpolation,
} from '../../src/ui/utils/layer-styles';
import {
  getGlowRadiusExpression,
  getHoverGlowRadiusExpression,
  getSelectionRingRadiusExpression,
  getZoomRadiusExpression,
} from '../../src/ui/components/elements/point/point-style';

describe('selection ring radius', () => {
  it('shared ring radius bakes stroke offset into interpolate stops', () => {
    const ring = getSelectionRingRadiusInterpolation();
    const point = getPointRadiusInterpolation();
    expect(ring[0]).toBe('interpolate');
    expect((ring[4] as number) > (point[4] as number)).toBe(true);
  });

  it('gk-point ring radius bakes stroke offset into interpolate stops', () => {
    const size = 6;
    const ring = getSelectionRingRadiusExpression(size);
    const point = getZoomRadiusExpression(size);
    expect(ring[0]).toBe('interpolate');
    expect((ring[4] as number) > (point[4] as number)).toBe(true);
  });

  it('shared ring radius clears point outline stroke', () => {
    const point = getPointRadiusInterpolation();
    const ringNoStroke = getSelectionRingRadiusInterpolation();
    const ringWithStroke = getSelectionRingRadiusInterpolation({}, 2);
    expect((ringWithStroke[4] as number) - (ringNoStroke[4] as number)).toBe(2);
    expect((ringWithStroke[4] as number) > (point[4] as number)).toBe(true);
  });

  it('gk-point ring radius clears point outline stroke', () => {
    const size = 6;
    const ringNoStroke = getSelectionRingRadiusExpression(size);
    const ringWithStroke = getSelectionRingRadiusExpression(size, 2);
    expect((ringWithStroke[4] as number) - (ringNoStroke[4] as number)).toBe(2);
  });
});

describe('glow radius', () => {
  it('shared glow radius bakes padding into interpolate stops', () => {
    const glow = getGlowRadiusInterpolation();
    expect(glow[0]).toBe('interpolate');
    const point = getPointRadiusInterpolation();
    expect((glow[4] as number) >= (point[4] as number)).toBe(true);
  });

  it('shared hover glow is slightly larger than base glow', () => {
    const hover = getHoverGlowRadiusInterpolation();
    const glow = getGlowRadiusInterpolation();
    expect((hover[10] as number) >= (glow[10] as number)).toBe(true);
  });

  it('gk-point glow bakes padding into interpolate stops', () => {
    const size = 6;
    const glow = getGlowRadiusExpression(size);
    expect(glow[0]).toBe('interpolate');
    expect(getHoverGlowRadiusExpression(size)[10]).toBeGreaterThanOrEqual(glow[10] as number);
  });
});
