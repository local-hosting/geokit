import { describe, expect, it } from 'vitest';
import {
  applyEmbedScaleToSharedPointLayerOptions,
  embedPointScaleFromHeight,
  resolveEmbedPointScale,
  scaleSharedPointPaintForEmbed,
} from '../../../src/ui/utils/embed-point-scale';
import type { ApplySharedPointPaintOptions } from '../../../src/ui/utils/shared-point-paint';

describe('embedPointScaleFromHeight', () => {
  it('returns 1 at or above reference height', () => {
    expect(embedPointScaleFromHeight(400)).toBe(1);
    expect(embedPointScaleFromHeight(800)).toBe(1);
  });

  it('scales down for shorter containers', () => {
    expect(embedPointScaleFromHeight(200)).toBe(0.5);
    expect(embedPointScaleFromHeight(180)).toBeCloseTo(0.45);
  });

  it('respects minScale floor', () => {
    expect(embedPointScaleFromHeight(40, { minScale: 0.35 })).toBe(0.35);
  });
});

describe('resolveEmbedPointScale', () => {
  it('returns explicit embedPointScale when set', () => {
    expect(resolveEmbedPointScale({ embedPointScale: 0.6 })).toBe(0.6);
  });

  it('derives from map container when compactPoints is true', () => {
    const map = {
      getContainer: () => ({ clientHeight: 180 }) as HTMLElement,
    };
    expect(resolveEmbedPointScale({ map: map as never, compactPoints: true })).toBeCloseTo(0.45);
  });

  it('returns 1 when compactPoints is false', () => {
    const map = {
      getContainer: () => ({ clientHeight: 180 }) as HTMLElement,
    };
    expect(resolveEmbedPointScale({ map: map as never, compactPoints: false })).toBe(1);
  });
});

describe('scaleSharedPointPaintForEmbed', () => {
  it('scales interpolate radius stops', () => {
    const paint: ApplySharedPointPaintOptions = {
      ids: { sourceId: 's', glowLayerId: 'g', pointLayerId: 'p' },
      pointColorExpression: ['literal', '#fff'],
      pointRadiusExpression: ['interpolate', ['exponential', 1.5], ['zoom'], 0, 3, 10, 4],
    };

    const scaled = scaleSharedPointPaintForEmbed(paint, 0.5);
    expect(scaled.pointRadiusExpression).toEqual([
      'interpolate',
      ['exponential', 1.5],
      ['zoom'],
      0,
      2,
      10,
      4,
    ]);
  });
});

describe('applyEmbedScaleToSharedPointLayerOptions', () => {
  it('scales glow hit area with embed scale', () => {
    const map = {
      getContainer: () => ({ clientHeight: 200 }) as HTMLElement,
    };
    const paint: ApplySharedPointPaintOptions = {
      ids: { sourceId: 's', glowLayerId: 'g', pointLayerId: 'p' },
      pointColorExpression: ['literal', '#fff'],
      pointRadiusExpression: ['literal', 4],
    };

    const result = applyEmbedScaleToSharedPointLayerOptions({
      map: map as never,
      paint,
      glowHitAreaScale: 2,
      compactPoints: true,
    });

    expect(result.embedScale).toBe(0.5);
    expect(result.glowHitAreaScale).toBe(1);
    expect(result.paint.pointRadiusExpression).toEqual(['literal', 2]);
  });
});

describe('scaleSharedPointPaintForEmbed zoom growth', () => {
  it('only shrinks low-zoom stops so points grow when zoomed in', () => {
    const paint: ApplySharedPointPaintOptions = {
      ids: { sourceId: 's', glowLayerId: 'g', pointLayerId: 'p' },
      pointColorExpression: ['literal', '#fff'],
      pointRadiusExpression: ['interpolate', ['exponential', 1.5], ['zoom'], 0, 3, 8, 4, 12, 6],
    };

    const scaled = scaleSharedPointPaintForEmbed(paint, 0.5);
    expect(scaled.pointRadiusExpression).toEqual([
      'interpolate',
      ['exponential', 1.5],
      ['zoom'],
      0,
      2,
      8,
      4,
      12,
      6,
    ]);
  });
});
