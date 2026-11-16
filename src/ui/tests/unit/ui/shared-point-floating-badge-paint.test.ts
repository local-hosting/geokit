/** @vitest-environment happy-dom */
import { afterEach, describe, expect, it } from 'vitest';
import {
  SHARED_POINT_FLOATING_BADGE_COLORED_RING_WIDTH,
  SHARED_POINT_FLOATING_BADGE_FILL,
  SHARED_POINT_FLOATING_BADGE_FLOAT_TRANSLATE,
  SHARED_POINT_FLOATING_BADGE_OUTER_STROKE_WIDTH,
  SHARED_POINT_FLOATING_BADGE_RADIUS_EXPRESSION,
  sampleZoomInterpolateValue,
  sharedPointFloatingBadgeOuterStrokeWidthExpression,
  SHARED_POINT_FLOATING_BADGE_RING_STROKE_WIDTH,
  SHARED_POINT_FLOATING_BADGE_SELECTED_RADIUS_SCALE,
  SHARED_POINT_FLOATING_BADGE_SELECTED_TRANSLATE,
  SHARED_POINT_FLOATING_BADGE_SELECT_ANIMATION_MS,
  SHARED_POINT_FLOATING_BADGE_SELECTION_RING_COLOR,
  SHARED_POINT_FLOATING_BADGE_SHADOW_BLUR,
  SHARED_POINT_FLOATING_BADGE_SHADOW_OPACITY,
  SHARED_POINT_FLOATING_BADGE_SHADOW_PITCH_ALIGNMENT,
  SHARED_POINT_FLOATING_BADGE_SHADOW_PITCH_SCALE,
  SHARED_POINT_FLOATING_BADGE_SHADOW_RADIUS_PAD,
  SHARED_POINT_FLOATING_BADGE_SHADOW_TRANSLATE,
  annotatePointFeaturesFloatingBadgeHover,
  applySharedPointLayerPaint,
  mixHexColors,
  resolveSharedPointFloatingBadgeTokens,
  sharedPointExcludeFeatureIdFilter,
  sharedPointFloatingBadgeHoverRingColorAt,
  sharedPointFloatingBadgePaintExpressions,
  sharedPointFloatingBadgeSelectedColor,
  sharedPointFloatingBadgeSelectedRadiusExpression,
  sharedPointFloatingBadgeLerpTranslate,
  sharedPointFloatingBadgeNormalizeViewportTranslate,
  sharedPointFloatingBadgeSelectionTranslateAt,
  sharedPointFloatingBadgeShadowRadiusExpression,
  sharedPointFloatingBadgeTranslatesNearlyEqual,
  sharedPointFloatingBadgeViewportTranslate,
  sharedPointHitLayerIds,
  syncSharedPointSelectedLayerFilter,
  literalNumberFromPaintExpression,
  SHARED_POINT_FLOATING_BADGE_HOVER_ANIMATION_MS,
  SHARED_POINT_FLOATING_BADGE_SHADOW_OPACITY,
  SHARED_POINT_FLOATING_BADGE_SOFT_BRIGHTEN,
  SHARED_POINT_FLOATING_BADGE_GLASS_OPACITY,
  SHARED_POINT_FLOATING_BADGE_GLASS_BLUR,
  SHARED_POINT_FLOATING_BADGE_GLASS_PAD,
  SHARED_POINT_FLOATING_BADGE_STROKE_OPACITY,
  SHARED_POINT_FLOATING_BADGE_OUTER_STROKE_OPACITY,
  sharedPointFloatingBadgeSoftColor,
  sharedPointFloatingBadgeRestingColor,
  sharedPointFloatingBadgeTranslateAtZoom,
  sharedPointFloatingBadgeTranslateExpression,
  sharedPointGlassLayerId,
} from '../../../src/utils/shared-point-paint';

describe('sharedPointFloatingBadgePaintExpressions', () => {
  afterEach(() => {
    for (const name of [
      '--gk-badge-fill',
      '--gk-badge-float-y',
      '--gk-badge-selected-y',
      '--gk-badge-select-ms',
      '--gk-badge-shadow-opacity',
    ]) {
      document.documentElement.style.removeProperty(name);
    }
  });

  it('builds floating-badge paint with map-pitched ground shadow', () => {
    const paint = sharedPointFloatingBadgePaintExpressions({
      fallbackColor: '#2dbad2',
      themeElement: null,
    });

    const soft = sharedPointFloatingBadgeSoftColor('#2dbad2');
    // Unselected: white core + key ring + white outer stroke.
    expect(paint.pointColorExpression).toBe(SHARED_POINT_FLOATING_BADGE_FILL);
    expect(paint.outerStrokeColorExpression).toBe(SHARED_POINT_FLOATING_BADGE_FILL);
    expect(paint.selectionOuterStrokeColorExpression).toEqual(paint.selectionFillExpression);
    // Radius + ring + outer stroke all zoom-interpolate so the badge scales with the map.
    expect(paint.pointRadiusExpression[0]).toBe('interpolate');
    expect(paint.pointRadiusExpression[2]).toEqual(['zoom']);
    expect(paint.strokeWidthExpression[0]).toBe('interpolate');
    expect(paint.strokeWidthExpression[2]).toEqual(['zoom']);
    expect(paint.outerStrokeWidthExpression[0]).toBe('interpolate');
    expect(paint.outerStrokeWidthExpression[2]).toEqual(['zoom']);
    // Outer rim matches ring width so it reads as a clear band around the badge.
    expect(SHARED_POINT_FLOATING_BADGE_OUTER_STROKE_WIDTH).toBe(7);
    // Must stay visible when zoomed out — sub-2px rims disappear on city basemaps.
    const outerWidth = sharedPointFloatingBadgeOuterStrokeWidthExpression();
    expect(sampleZoomInterpolateValue(outerWidth, 6)).toBeGreaterThanOrEqual(2);
    expect(sampleZoomInterpolateValue(outerWidth, 10)).toBeGreaterThanOrEqual(
      SHARED_POINT_FLOATING_BADGE_OUTER_STROKE_WIDTH * 0.45
    );
    expect(paint.strokeColorExpression).toEqual(['coalesce', ['get', '_color'], sharedPointFloatingBadgeRestingColor('#2dbad2')]);
    expect(paint.strokeOpacity).toBe(SHARED_POINT_FLOATING_BADGE_STROKE_OPACITY);
    expect(paint.outerStrokeOpacity).toBe(SHARED_POINT_FLOATING_BADGE_OUTER_STROKE_OPACITY);
    expect(SHARED_POINT_FLOATING_BADGE_OUTER_STROKE_OPACITY).toBeGreaterThanOrEqual(0.9);
    expect(SHARED_POINT_FLOATING_BADGE_STROKE_OPACITY).toBeGreaterThanOrEqual(0.72);
    expect(SHARED_POINT_FLOATING_BADGE_STROKE_OPACITY).toBe(1);
    // Tiny when zoomed out; readable at city; street core smaller than the old 44px stop.
    const radiusAt = (zoom: number) => {
      const stops = paint.pointRadiusExpression as unknown[];
      for (let i = 3; i < stops.length; i += 2) {
        if (stops[i] === zoom) return stops[i + 1] as number;
      }
      throw new Error(`missing zoom stop ${zoom}`);
    };
    expect(radiusAt(6)).toBeLessThanOrEqual(3);
    expect(radiusAt(10)).toBeGreaterThan(radiusAt(6));
    expect(radiusAt(14)).toBeGreaterThanOrEqual(8);
    expect(radiusAt(18)).toBeGreaterThanOrEqual(24);
    expect(radiusAt(18)).toBeLessThan(42);
    expect(radiusAt(18)).toBeGreaterThan(radiusAt(14));
    // Soft tint remains for frosted glass (not the unselected core).
    expect(SHARED_POINT_FLOATING_BADGE_SOFT_BRIGHTEN).toBeGreaterThanOrEqual(0.45);
    expect(SHARED_POINT_FLOATING_BADGE_SOFT_BRIGHTEN).toBeLessThanOrEqual(0.65);
    expect(sharedPointFloatingBadgeSoftColor('#9acd32')).not.toMatch(/^#f[0-9a-f]{5}$/i);
    // Slight frosted disc behind unselected badges only.
    expect(paint.glassOpacity).toBe(SHARED_POINT_FLOATING_BADGE_GLASS_OPACITY);
    expect(paint.glassBlur).toBe(SHARED_POINT_FLOATING_BADGE_GLASS_BLUR);
    expect(paint.glassColorExpression).toEqual(['coalesce', ['get', '_colorSoft'], soft]);
    expect(SHARED_POINT_FLOATING_BADGE_GLASS_OPACITY).toBeGreaterThanOrEqual(0.28);
    expect(SHARED_POINT_FLOATING_BADGE_GLASS_OPACITY).toBeLessThanOrEqual(0.5);
    expect(SHARED_POINT_FLOATING_BADGE_GLASS_BLUR).toBeGreaterThanOrEqual(0.4);
    expect(SHARED_POINT_FLOATING_BADGE_GLASS_PAD).toBeGreaterThanOrEqual(1);
    expect(SHARED_POINT_FLOATING_BADGE_GLASS_PAD).toBeLessThanOrEqual(2);
    expect(paint.paintRevision).toBeGreaterThanOrEqual(17);
    // Float + shadow cast zoom-scale so continental views keep dots on their points.
    expect(paint.pointTranslate[0]).toBe('interpolate');
    expect(paint.pointTranslate).toEqual(
      sharedPointFloatingBadgeTranslateExpression(SHARED_POINT_FLOATING_BADGE_FLOAT_TRANSLATE[1])
    );
    const floatAt6 = sharedPointFloatingBadgeTranslateAtZoom(
      SHARED_POINT_FLOATING_BADGE_FLOAT_TRANSLATE[1],
      6
    );
    const floatAt16 = sharedPointFloatingBadgeTranslateAtZoom(
      SHARED_POINT_FLOATING_BADGE_FLOAT_TRANSLATE[1],
      16
    );
    expect(Math.abs(floatAt6[1])).toBeLessThanOrEqual(1);
    // Resting badges stay grounded; select lift still zoom-scales when max Y is non-zero.
    expect(Math.abs(floatAt16[1])).toBeLessThanOrEqual(1);
    expect(Math.abs(sharedPointFloatingBadgeTranslateAtZoom(-24, 10)[1])).toBeGreaterThanOrEqual(8);
    expect(Math.abs(sharedPointFloatingBadgeTranslateAtZoom(-24, 10)[1])).toBeLessThanOrEqual(12);
    expect(
      Math.abs(
        sharedPointFloatingBadgeTranslateAtZoom(SHARED_POINT_FLOATING_BADGE_SELECTED_TRANSLATE[1], 16)[1]
      )
    ).toBeGreaterThanOrEqual(Math.abs(SHARED_POINT_FLOATING_BADGE_SELECTED_TRANSLATE[1]) * 0.9);
    expect(paint.glowTranslate[0]).toBe('interpolate');
    // Screen-aligned drop shadow — pitch does not squash it under the upright badge.
    expect(paint.glowPitchAlignment).toBe(SHARED_POINT_FLOATING_BADGE_SHADOW_PITCH_ALIGNMENT);
    expect(paint.glowPitchScale).toBe(SHARED_POINT_FLOATING_BADGE_SHADOW_PITCH_SCALE);
    expect(paint.glowPitchAlignment).toBe('viewport');
    expect(paint.glowPitchScale).toBe('map');
    expect(paint.glowBlur[0]).toBe('interpolate');
    expect(paint.glowColorExpression).toBe('#000000');
    expect(paint.glowOpacity[0]).toBe('interpolate');
    expect(paint.glowRadiusExpression).toEqual(sharedPointFloatingBadgeShadowRadiusExpression());
    // Soft / translucent ground contact — readable without a heavy black disk.
    expect(SHARED_POINT_FLOATING_BADGE_SHADOW_OPACITY).toBeGreaterThanOrEqual(0.22);
    expect(SHARED_POINT_FLOATING_BADGE_SHADOW_OPACITY).toBeLessThanOrEqual(0.36);
    expect(SHARED_POINT_FLOATING_BADGE_SHADOW_BLUR).toBeGreaterThanOrEqual(0.48);
    expect(SHARED_POINT_FLOATING_BADGE_SHADOW_BLUR).toBeLessThanOrEqual(0.62);
    // Pad is past the full badge; the cast offset does the peeking.
    expect(SHARED_POINT_FLOATING_BADGE_SHADOW_RADIUS_PAD).toBeGreaterThan(0);
    expect(SHARED_POINT_FLOATING_BADGE_SHADOW_RADIUS_PAD).toBeLessThanOrEqual(4);
    expect(paint.pointOpacityExpression?.[0]).toBe('case');
    expect(paint.pointOpacityExpression).toEqual(
      expect.arrayContaining([['boolean', ['feature-state', 'selected'], false], 0])
    );
  });

  it('keeps float height and shadow tiny when zoomed out', () => {
    const paint = sharedPointFloatingBadgePaintExpressions({
      fallbackColor: '#2dbad2',
      themeElement: null,
    });
    const radiusAt = (expr: unknown[], zoom: number) => {
      for (let i = 3; i < expr.length; i += 2) {
        if (expr[i] === zoom) return expr[i + 1] as number;
      }
      throw new Error(`missing zoom stop ${zoom}`);
    };
    const shadow = paint.glowRadiusExpression as unknown[];
    const glass = paint.glassRadiusExpression as unknown[];
    // Continental: shadow hugs the badge stack (no fat black disks).
    expect(radiusAt(shadow, 6) - radiusAt(glass, 6)).toBeLessThanOrEqual(1.25);
    const opacityAt = (zoom: number) => {
      const expr = paint.glowOpacity as unknown[];
      for (let i = 3; i < expr.length; i += 2) {
        if (expr[i] === zoom) return expr[i + 1] as number;
      }
      throw new Error(`missing opacity stop ${zoom}`);
    };
    // City+ zooms keep a readable drop shadow; continental stays faint.
    expect(opacityAt(6)).toBeLessThanOrEqual(0.1);
    expect(opacityAt(12)).toBeGreaterThanOrEqual(0.16);
    expect(opacityAt(16)).toBeGreaterThanOrEqual(0.22);
    expect(Math.abs(sharedPointFloatingBadgeTranslateAtZoom(-24, 6)[1])).toBeLessThanOrEqual(1);
    expect(Math.abs(sharedPointFloatingBadgeTranslateAtZoom(-24, 8)[1])).toBeLessThanOrEqual(6);
  });

  it('clears glass at city zoom so the south-edge ground shadow can peek', () => {
    const paint = sharedPointFloatingBadgePaintExpressions({
      fallbackColor: '#9acd32',
      themeElement: null,
    });
    const radiusAt = (expr: unknown[], zoom: number) => {
      for (let i = 3; i < expr.length; i += 2) {
        if (expr[i] === zoom) return expr[i + 1] as number;
      }
      throw new Error(`missing zoom stop ${zoom}`);
    };
    const floatY = Math.abs(sharedPointFloatingBadgeTranslateAtZoom(-24, 10)[1]);
    const glass = radiusAt(paint.glassRadiusExpression as unknown[], 10);
    const shadow = radiusAt(paint.glowRadiusExpression as unknown[], 10);
    // After float, glass bottom must sit above the shadow rim (screen-space).
    expect(glass - floatY).toBeLessThan(shadow);
    // South-biased cast — not a centered halo.
    expect(SHARED_POINT_FLOATING_BADGE_SHADOW_TRANSLATE[1]).toBeGreaterThanOrEqual(4);
    expect(SHARED_POINT_FLOATING_BADGE_SHADOW_TRANSLATE[1]).toBeGreaterThan(
      SHARED_POINT_FLOATING_BADGE_SHADOW_TRANSLATE[0]
    );
  });

  it('inverts selected badges — darker key core + white ring + key outer', () => {
    const paint = sharedPointFloatingBadgePaintExpressions({
      fallbackColor: '#2dbad2',
      themeElement: null,
    });
    // Selected: darkened key core, white middle ring, darkened key outer ring.
    expect(paint.selectionFillExpression).toEqual([
      'coalesce',
      ['get', '_colorSelected'],
      ['get', '_color'],
      sharedPointFloatingBadgeSelectedColor(sharedPointFloatingBadgeRestingColor('#2dbad2')),
    ]);
    expect(paint.selectionStrokeColorExpression).toBe(SHARED_POINT_FLOATING_BADGE_FILL);
    expect(paint.selectionOuterStrokeColorExpression).toEqual(paint.selectionFillExpression);
    expect(paint.paintRevision).toBeGreaterThanOrEqual(20);
  });

  it('applyPaint uses seam-plug fill plus stroked outer rim', () => {
    const setPaintProperty = vi.fn();
    const map = {
      getSource: vi.fn(() => ({})),
      getLayer: vi.fn((id: string) =>
        id === 'venues-point' ||
        id === 'venues-glow' ||
        id === 'venues-point-outer-stroke'
          ? {}
          : undefined
      ),
      setPaintProperty,
    };
    const paint = sharedPointFloatingBadgePaintExpressions({
      fallbackColor: '#9acd32',
      themeElement: null,
    });

    applySharedPointLayerPaint(map as never, {
      ids: {
        sourceId: 'venues',
        glowLayerId: 'venues-glow',
        pointLayerId: 'venues-point',
      },
      ...paint,
    });

    const radiusCall = setPaintProperty.mock.calls.find(
      (c) => c[0] === 'venues-point-outer-stroke' && c[1] === 'circle-radius'
    );
    expect(radiusCall).toBeTruthy();
    const radius = radiusCall?.[2] as unknown[];
    expect(radius[0]).toBe('interpolate');
    // Stroke starts at fill+ring — larger than fill alone.
    const fillAt = (zoom: number) => {
      const stops = paint.pointRadiusExpression as unknown[];
      for (let i = 3; i < stops.length; i += 2) {
        if (stops[i] === zoom) return stops[i + 1] as number;
      }
      throw new Error(`missing fill stop ${zoom}`);
    };
    const outerAt = (zoom: number) => {
      for (let i = 3; i < radius.length; i += 2) {
        if (radius[i] === zoom) return radius[i + 1] as number;
      }
      throw new Error(`missing outer stop ${zoom}`);
    };
    expect(outerAt(10)).toBeGreaterThan(fillAt(10));
    expect(outerAt(16)).toBeGreaterThan(fillAt(16));
    expect(setPaintProperty).toHaveBeenCalledWith(
      'venues-point-outer-stroke',
      'circle-color',
      SHARED_POINT_FLOATING_BADGE_FILL
    );
    expect(setPaintProperty).toHaveBeenCalledWith(
      'venues-point-outer-stroke',
      'circle-stroke-width',
      paint.outerStrokeWidthExpression
    );
  });

  it('skips selection-badge paint while selection source has a feature', () => {
    const setPaintProperty = vi.fn();
    const map = {
      getSource: vi.fn((id: string) =>
        id === 'venues-selection'
          ? { _data: { features: [{ type: 'Feature', properties: { _badgeIcon: 'cube' } }] } }
          : {}
      ),
      getLayer: vi.fn((id: string) =>
        id === 'venues-point-selection-badge' || id === 'venues-point-selection-badge-outer'
          ? {}
          : undefined
      ),
      setPaintProperty,
    };
    const paint = sharedPointFloatingBadgePaintExpressions({
      fallbackColor: '#9acd32',
      themeElement: null,
    });

    applySharedPointLayerPaint(map as never, {
      ids: {
        sourceId: 'venues',
        glowLayerId: 'venues-glow',
        pointLayerId: 'venues-point',
      },
      ...paint,
    });

    expect(setPaintProperty).not.toHaveBeenCalledWith(
      'venues-point-selection-badge',
      'circle-stroke-width',
      expect.anything()
    );
  });

  it('applyPaint keeps selected key-color core with white ring + key outer', () => {
    const setPaintProperty = vi.fn();
    const map = {
      getSource: vi.fn(() => ({})),
      getLayer: vi.fn((id: string) =>
        id === 'venues-point' ||
        id === 'venues-glow' ||
        id === 'venues-point-selection-badge' ||
        id === 'venues-point-selection-badge-outer'
          ? {}
          : undefined
      ),
      setPaintProperty,
    };
    const paint = sharedPointFloatingBadgePaintExpressions({
      fallbackColor: '#9acd32',
      themeElement: null,
    });

    applySharedPointLayerPaint(map as never, {
      ids: {
        sourceId: 'venues',
        glowLayerId: 'venues-glow',
        pointLayerId: 'venues-point',
      },
      ...paint,
    });

    expect(setPaintProperty).toHaveBeenCalledWith(
      'venues-point-selection-badge',
      'circle-color',
      paint.selectionFillExpression
    );
    expect(setPaintProperty).toHaveBeenCalledWith(
      'venues-point-selection-badge',
      'circle-stroke-color',
      paint.selectionStrokeColorExpression
    );
    expect(setPaintProperty).toHaveBeenCalledWith(
      'venues-point-selection-badge-outer',
      'circle-color',
      paint.selectionOuterStrokeColorExpression
    );
    expect(setPaintProperty).toHaveBeenCalledWith(
      'venues-point-selection-badge-outer',
      'circle-stroke-width',
      paint.outerStrokeWidthExpression
    );
  });

  it('lifts the selected badge above the shadow and softens the ground shadow', () => {
    const paint = sharedPointFloatingBadgePaintExpressions({
      fallbackColor: '#2dbad2',
      themeElement: null,
    });
    expect(paint.selectionGroundBadge).toBe(true);
    expect(paint.selectionGroundBadgeFallbackColor).toBe('#2dbad2');
    expect(paint.glowTranslate[0]).toBe('interpolate');
    expect(paint.pointTranslate[0]).toBe('interpolate');
    const floatY = sharedPointFloatingBadgeTranslateAtZoom(
      SHARED_POINT_FLOATING_BADGE_FLOAT_TRANSLATE[1],
      16
    )[1];
    const selectedY = sharedPointFloatingBadgeTranslateAtZoom(
      SHARED_POINT_FLOATING_BADGE_SELECTED_TRANSLATE[1],
      16
    )[1];
    expect(selectedY).toBeLessThan(floatY);
    expect(selectedY).toBeLessThan(0);
    expect(paint.outerStrokeWidthExpression[0]).toBe('interpolate');
    expect(paint.outerStrokeWidthExpression[2]).toEqual(['zoom']);
    // Selection shadow lives on the selection source (MapLibre rejects case+interpolate radius).
    // Lifted badge: wider + fainter than resting contact shadow.
    expect(paint.selectedShadowScale).toBeGreaterThan(1);
    expect(paint.selectedShadowOpacity).toBeLessThan(SHARED_POINT_FLOATING_BADGE_SHADOW_OPACITY);
    expect(paint.glowRadiusExpression).toEqual(sharedPointFloatingBadgeShadowRadiusExpression());
    // Selected keeps resting size — lift only, no shrink.
    expect(SHARED_POINT_FLOATING_BADGE_SELECTED_RADIUS_SCALE).toBe(1);
    expect(sharedPointFloatingBadgeSelectedRadiusExpression()).toEqual(
      SHARED_POINT_FLOATING_BADGE_RADIUS_EXPRESSION
    );
    expect(SHARED_POINT_FLOATING_BADGE_SELECTION_RING_COLOR).toMatch(/rgba\(\s*0,\s*0,\s*0,\s*0\s*\)/);
  });

  it('builds a filter that excludes the selected feature from floating layers', () => {
    expect(sharedPointExcludeFeatureIdFilter('venueId', 'abc')).toEqual([
      '!=',
      ['to-string', ['get', 'venueId']],
      'abc',
    ]);
    expect(sharedPointExcludeFeatureIdFilter('venueId', null)).toBeNull();
  });

  it('also filters the glow layer so the selection shadow can take over', () => {
    const filters: Array<{ id: string; filter: unknown }> = [];
    const map = {
      getLayer: (id: string) =>
        ['p', 'p-outer-stroke', 'p-glass', 'g'].includes(id) ? {} : undefined,
      setFilter: (id: string, filter: unknown) => {
        filters.push({ id, filter });
      },
    };
    syncSharedPointSelectedLayerFilter(map, {
      pointLayerId: 'p',
      glowLayerId: 'g',
      promoteId: 'venueId',
      featureId: 'buffalo-harbor',
    });
    expect(filters.map((f) => f.id).sort()).toEqual([
      'g',
      'p',
      'p-glass',
      'p-outer-stroke',
    ]);
  });


  it('registers outer stroke, glass, grounded badge, and hover-lift badge layers as pointer hit targets', () => {
    // selection-ring stays opacity 0 — exclude it so empty ring hits cannot steal click dedup
    expect(sharedPointGlassLayerId('canvas-venues-point')).toBe('canvas-venues-point-glass');
    expect(sharedPointHitLayerIds('canvas-venues-point', 'canvas-venues-glow')).toEqual([
      'canvas-venues-glow',
      'canvas-venues-point',
      'canvas-venues-point-outer-stroke',
      'canvas-venues-point-glass',
      'canvas-venues-point-selection-badge',
      'canvas-venues-point-selection-badge-outer',
      'canvas-venues-point-hover-badge',
      'canvas-venues-point-hover-badge-outer',
      'canvas-venues-point-rounded-outer',
      'canvas-venues-point-selection-rounded-outer',
    ]);
  });

  it('keeps viewport translate math in small shared helpers', () => {
    expect(sharedPointFloatingBadgeViewportTranslate(-12)).toEqual([0, -12]);
    expect(sharedPointFloatingBadgeNormalizeViewportTranslate([3, -12])).toEqual([0, -12]);
    expect(sharedPointFloatingBadgeTranslatesNearlyEqual([0, -12], [0, -12.2])).toBe(true);
    expect(sharedPointFloatingBadgeTranslatesNearlyEqual([0, 0], [0, -12])).toBe(false);
    expect(sharedPointFloatingBadgeLerpTranslate([0, 0], [0, -12], 0.5)).toEqual([0, -6]);
  });

  it('eases the selection badge translate from resting height up to selected', () => {
    const from = SHARED_POINT_FLOATING_BADGE_FLOAT_TRANSLATE;
    const to = SHARED_POINT_FLOATING_BADGE_SELECTED_TRANSLATE;
    expect(sharedPointFloatingBadgeSelectionTranslateAt(from, to, 0)).toEqual(from);
    expect(
      sharedPointFloatingBadgeSelectionTranslateAt(
        from,
        to,
        SHARED_POINT_FLOATING_BADGE_SELECT_ANIMATION_MS
      )
    ).toEqual(to);
    const mid = sharedPointFloatingBadgeSelectionTranslateAt(
      from,
      to,
      SHARED_POINT_FLOATING_BADGE_SELECT_ANIMATION_MS / 2
    );
    // Lift: Y becomes more negative (up on screen).
    expect(mid[1]).toBeLessThan(from[1]);
    expect(mid[1]).toBeGreaterThan(to[1]);
    expect(SHARED_POINT_FLOATING_BADGE_SELECT_ANIMATION_MS).toBeGreaterThanOrEqual(120);
    expect(SHARED_POINT_FLOATING_BADGE_SELECT_ANIMATION_MS).toBeLessThanOrEqual(280);
  });

  it('reads floating-badge look from --gk-badge-* design tokens', () => {
    document.documentElement.style.setProperty('--gk-badge-fill', '#fafafa');
    document.documentElement.style.setProperty('--gk-badge-float-y', '-30');
    document.documentElement.style.setProperty('--gk-badge-selected-y', '-26');
    document.documentElement.style.setProperty('--gk-badge-select-ms', '220');
    document.documentElement.style.setProperty('--gk-badge-shadow-opacity', '0.6');

    const tokens = resolveSharedPointFloatingBadgeTokens(document.documentElement);
    expect(tokens.fill).toBe('#fafafa');
    expect(tokens.floatTranslate).toEqual([0, -30]);
    expect(tokens.selectedTranslate).toEqual([0, -26]);
    expect(tokens.selectAnimationMs).toBe(220);
    expect(tokens.shadowOpacity).toBe(0.6);

    const paint = sharedPointFloatingBadgePaintExpressions({
      fallbackColor: '#2dbad2',
      themeElement: document.documentElement,
    });
    // Unselected core uses token fill (white/paper); selected fill is a darker key tint.
    expect(paint.pointColorExpression).toBe('#fafafa');
    expect(paint.selectionFillExpression).toEqual([
      'coalesce',
      ['get', '_colorSelected'],
      ['get', '_color'],
      sharedPointFloatingBadgeSelectedColor(sharedPointFloatingBadgeRestingColor('#2dbad2')),
    ]);
    expect(paint.pointTranslate).toEqual(sharedPointFloatingBadgeTranslateExpression(-30));
    expect((paint.glowOpacity as unknown[])[0]).toBe('interpolate');
    // Token sets max opacity; zoom expression reaches it when close in.
    const opacityStops = paint.glowOpacity as unknown[];
    expect(opacityStops[opacityStops.length - 1]).toBe(0.6);
    expect(paint.selectAnimationMs).toBe(220);
  });

  it('lerps hover ring color linearly so start/stop feel instant and fluid', () => {
    expect(mixHexColors('#2dbad2', '#96dde9', 0)).toBe('#2dbad2');
    expect(mixHexColors('#2dbad2', '#96dde9', 1)).toBe('#96dde9');
    expect(sharedPointFloatingBadgeHoverRingColorAt('#2dbad2', '#96dde9', 0)).toBe('#2dbad2');
    expect(
      sharedPointFloatingBadgeHoverRingColorAt(
        '#2dbad2',
        '#96dde9',
        SHARED_POINT_FLOATING_BADGE_HOVER_ANIMATION_MS
      )
    ).toBe('#96dde9');
    // Linear mid — no ease delay at the ends.
    expect(
      sharedPointFloatingBadgeHoverRingColorAt(
        '#2dbad2',
        '#96dde9',
        SHARED_POINT_FLOATING_BADGE_HOVER_ANIMATION_MS / 2
      )
    ).toBe(mixHexColors('#2dbad2', '#96dde9', 0.5));
  });

  it('annotates missing _color from fallback so selection never falls through to bare theme ink', () => {
    const out = annotatePointFeaturesFloatingBadgeHover(
      {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: { venueId: 'dunkirk' },
            geometry: { type: 'Point', coordinates: [-79.33, 42.48] },
          },
          {
            type: 'Feature',
            properties: { venueId: 'buffalo', _color: '#9acd32' },
            geometry: { type: 'Point', coordinates: [-78.88, 42.88] },
          },
        ],
      },
      { fallbackColor: '#2dbad2' }
    );
    expect(out.features[0]?.properties?._color).toBe(sharedPointFloatingBadgeRestingColor('#2dbad2'));
    expect(out.features[0]?.properties?._colorSoft).toBe(
      sharedPointFloatingBadgeSoftColor(sharedPointFloatingBadgeRestingColor('#2dbad2'))
    );
    expect(out.features[0]?.properties?._colorHover).toEqual(expect.any(String));
    expect(out.features[0]?.properties?._colorSelected).toBe(
      sharedPointFloatingBadgeSelectedColor(sharedPointFloatingBadgeRestingColor('#2dbad2'))
    );
    expect(out.features[1]?.properties?._color).toBe(sharedPointFloatingBadgeRestingColor('#9acd32'));
    expect(out.features[1]?.properties?._colorSelected).toBe(
      sharedPointFloatingBadgeSelectedColor(sharedPointFloatingBadgeRestingColor('#9acd32'))
    );
    expect(out.features[1]?.properties?._colorSoft).toBe(
      sharedPointFloatingBadgeSoftColor(sharedPointFloatingBadgeRestingColor('#9acd32'))
    );
  });

  it('re-stamps placeholder _color when locker fallback arrives after first paint', () => {
    const out = annotatePointFeaturesFloatingBadgeHover(
      {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: { venueId: 'buffalo', _color: '#888888' },
            geometry: { type: 'Point', coordinates: [-78.88, 42.88] },
          },
        ],
      },
      { fallbackColor: '#9acd32' }
    );
    expect(out.features[0]?.properties?._color).toBe(sharedPointFloatingBadgeRestingColor('#9acd32'));
    expect(out.features[0]?.properties?._colorResting).toBe(sharedPointFloatingBadgeRestingColor('#9acd32'));
    expect(out.features[0]?.properties?._colorKey).toBe('#9acd32');
  });

  it('keeps hover at resting float height (lighten only — no raise/lower)', () => {
    const paint = sharedPointFloatingBadgePaintExpressions({
      fallbackColor: '#2dbad2',
      themeElement: null,
    });
    expect(paint.skipFeatureStateHoverGlow).toBe(true);
    expect(JSON.stringify(paint.strokeColorExpression)).not.toContain('feature-state');
    expect(paint.strokeColorExpression).toEqual(['coalesce', ['get', '_color'], sharedPointFloatingBadgeRestingColor('#2dbad2')]);
    // Hover must not change height — select lifts above resting.
    expect(paint.hoverTranslate).toEqual(paint.pointTranslate);
    const floatY = sharedPointFloatingBadgeTranslateAtZoom(
      SHARED_POINT_FLOATING_BADGE_FLOAT_TRANSLATE[1],
      16
    )[1];
    const selectedY = sharedPointFloatingBadgeTranslateAtZoom(
      SHARED_POINT_FLOATING_BADGE_SELECTED_TRANSLATE[1],
      16
    )[1];
    expect(selectedY).toBeLessThan(floatY);
    expect(paint.pointTranslateAnchor).toBe('viewport');
  });
});

