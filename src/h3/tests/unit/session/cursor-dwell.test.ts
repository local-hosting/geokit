import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createH3CursorDwell } from '@doppler-group/geokit/h3';

describe('h3 cursor dwell', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(0);
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('reveals cell after dwellMs when pointer rests on same cell', () => {
    const onReveal = vi.fn();
    const dwell = createH3CursorDwell({
      dwellMs: 500,
      resolveCellId: () => 'abc',
      onReveal,
    });

    dwell.onCursorMove(38.2, -85.7);
    vi.advanceTimersByTime(499);
    expect(onReveal).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(onReveal).toHaveBeenCalledWith('abc');
    dwell.dispose();
  });

  it('resets timer when cell changes before dwell completes', () => {
    const onReveal = vi.fn();
    let cell = 'a';
    const dwell = createH3CursorDwell({
      dwellMs: 500,
      resolveCellId: () => cell,
      onReveal,
    });

    dwell.onCursorMove(1, 1);
    vi.advanceTimersByTime(400);
    cell = 'b';
    dwell.onCursorMove(2, 2);
    vi.advanceTimersByTime(400);
    expect(onReveal).not.toHaveBeenCalled();

    vi.advanceTimersByTime(100);
    expect(onReveal).toHaveBeenCalledWith('b');
    dwell.dispose();
  });

  it('does not reveal already-seen cells', () => {
    const onReveal = vi.fn();
    const revealed = new Set(['abc']);
    const dwell = createH3CursorDwell({
      dwellMs: 100,
      resolveCellId: () => 'abc',
      isAlreadyRevealed: (id) => revealed.has(id),
      onReveal,
    });

    dwell.onCursorMove(1, 1);
    vi.advanceTimersByTime(200);
    expect(onReveal).not.toHaveBeenCalled();
    dwell.dispose();
  });

  it('clears pending reveal on cursor leave', () => {
    const onReveal = vi.fn();
    const dwell = createH3CursorDwell({
      dwellMs: 500,
      resolveCellId: () => 'abc',
      onReveal,
    });

    dwell.onCursorMove(1, 1);
    vi.advanceTimersByTime(200);
    dwell.onCursorLeave();
    vi.advanceTimersByTime(500);
    expect(onReveal).not.toHaveBeenCalled();
    dwell.dispose();
  });
});
