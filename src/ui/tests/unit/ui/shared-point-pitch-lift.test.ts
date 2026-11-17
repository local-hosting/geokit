import { describe, expect, it, vi } from 'vitest';

import {
  SHARED_POINT_FLOATING_BADGE_PITCH_LIFT_BOOST,
  attachSharedPointFloatingBadgePitchLift,
  sharedPointFloatingBadgeFloatYForPitch,
  sharedPointFloatingBadgePitchLiftFactor,
} from '../../../src/utils/paint/shared-point-pitch-lift';

describe('sharedPointFloatingBadgePitchLiftFactor', () => {
  it('is 1 at nadir and grows with pitch so angled cameras lift more', () => {
    expect(sharedPointFloatingBadgePitchLiftFactor(0)).toBe(1);
    expect(sharedPointFloatingBadgePitchLiftFactor(60)).toBeCloseTo(
      1 + SHARED_POINT_FLOATING_BADGE_PITCH_LIFT_BOOST * Math.sin((60 * Math.PI) / 180),
      5
    );
    expect(sharedPointFloatingBadgePitchLiftFactor(60)).toBeGreaterThan(
      sharedPointFloatingBadgePitchLiftFactor(30)
    );
    expect(sharedPointFloatingBadgePitchLiftFactor(85)).toBeGreaterThan(
      sharedPointFloatingBadgePitchLiftFactor(60)
    );
  });

  it('scales float Y so pitched views clear building roofs', () => {
    const base = -10;
    expect(sharedPointFloatingBadgeFloatYForPitch(base, 0)).toBe(-10);
    expect(sharedPointFloatingBadgeFloatYForPitch(base, 60)).toBeLessThan(-20);
  });
});

async function flushAnimationFrame(): Promise<void> {
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve());
  });
}

describe('attachSharedPointFloatingBadgePitchLift', () => {
  it('rewrites resting circle-translate when pitch changes', async () => {
    document.documentElement.style.setProperty('--gk-badge-float-y', '-10');
    document.documentElement.style.setProperty('--gk-badge-selected-y', '-6');

    const listeners = new Map<string, Set<() => void>>();
    const layers = new Set(['venues-point', 'venues-point-outer-stroke']);
    const paints = new Map<string, unknown>();
    const map = {
      getPitch: vi.fn(() => 0),
      getLayer: (id: string) => (layers.has(id) ? { type: 'circle' } : undefined),
      setPaintProperty: vi.fn((id: string, key: string, value: unknown) => {
        paints.set(`${id}:${key}`, value);
      }),
      on: (event: string, fn: () => void) => {
        if (!listeners.has(event)) listeners.set(event, new Set());
        listeners.get(event)!.add(fn);
      },
      off: (event: string, fn: () => void) => {
        listeners.get(event)?.delete(fn);
      },
    };

    const stop = attachSharedPointFloatingBadgePitchLift(map as never, {
      pointLayerId: 'venues-point',
    });

    await flushAnimationFrame();
    expect(map.setPaintProperty).toHaveBeenCalled();
    const atNadir = paints.get('venues-point:circle-translate') as unknown[];
    // Deep zoom stop stores max Y — at pitch 0 that is the token base (-10).
    expect(JSON.stringify(atNadir)).toContain('-10');

    map.getPitch.mockReturnValue(60);
    map.setPaintProperty.mockClear();
    for (const fn of listeners.get('pitch') ?? []) fn();
    // Pitch fires inside Mapbox transform/render — must not mutate paint sync.
    expect(map.setPaintProperty).not.toHaveBeenCalled();

    await flushAnimationFrame();
    const atPitch = paints.get('venues-point:circle-translate') as unknown[];
    expect(atPitch).not.toEqual(atNadir);
    expect(JSON.stringify(atPitch)).toContain(String(sharedPointFloatingBadgeFloatYForPitch(-10, 60)));

    stop();
    expect(listeners.get('pitch')?.size ?? 0).toBe(0);
    document.documentElement.style.removeProperty('--gk-badge-float-y');
    document.documentElement.style.removeProperty('--gk-badge-selected-y');
  });

  it('cancels a pending pitch paint apply on cleanup', async () => {
    document.documentElement.style.setProperty('--gk-badge-float-y', '-10');
    document.documentElement.style.setProperty('--gk-badge-selected-y', '-6');

    const listeners = new Map<string, Set<() => void>>();
    const layers = new Set(['venues-point']);
    const map = {
      getPitch: vi.fn(() => 0),
      getLayer: (id: string) => (layers.has(id) ? { type: 'circle' } : undefined),
      setPaintProperty: vi.fn(),
      on: (event: string, fn: () => void) => {
        if (!listeners.has(event)) listeners.set(event, new Set());
        listeners.get(event)!.add(fn);
      },
      off: (event: string, fn: () => void) => {
        listeners.get(event)?.delete(fn);
      },
    };

    const stop = attachSharedPointFloatingBadgePitchLift(map as never, {
      pointLayerId: 'venues-point',
    });
    await flushAnimationFrame();
    map.setPaintProperty.mockClear();

    map.getPitch.mockReturnValue(45);
    for (const fn of listeners.get('pitch') ?? []) fn();
    stop();
    await flushAnimationFrame();

    expect(map.setPaintProperty).not.toHaveBeenCalled();
    document.documentElement.style.removeProperty('--gk-badge-float-y');
    document.documentElement.style.removeProperty('--gk-badge-selected-y');
  });

  it('skips paint when getLayer throws mid style/terrain rebuild', async () => {
    document.documentElement.style.setProperty('--gk-badge-float-y', '-10');
    document.documentElement.style.setProperty('--gk-badge-selected-y', '-6');

    const listeners = new Map<string, Set<() => void>>();
    const map = {
      getPitch: vi.fn(() => 30),
      getLayer: vi.fn(() => {
        throw new TypeError("Cannot read properties of undefined (reading 'getOwnLayer')");
      }),
      setPaintProperty: vi.fn(),
      on: (event: string, fn: () => void) => {
        if (!listeners.has(event)) listeners.set(event, new Set());
        listeners.get(event)!.add(fn);
      },
      off: (event: string, fn: () => void) => {
        listeners.get(event)?.delete(fn);
      },
    };

    const stop = attachSharedPointFloatingBadgePitchLift(map as never, {
      pointLayerId: 'venues-point',
    });
    for (const fn of listeners.get('styledata') ?? []) fn();
    await expect(flushAnimationFrame()).resolves.toBeUndefined();
    expect(map.setPaintProperty).not.toHaveBeenCalled();

    stop();
    document.documentElement.style.removeProperty('--gk-badge-float-y');
    document.documentElement.style.removeProperty('--gk-badge-selected-y');
  });
});
