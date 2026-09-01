/**
 * Easing functions for animation and simulation playback.
 * Input and output are normalized to the 0–1 range.
 */

export function easeInOutCubic(t: number): number {
  const clamped = Math.max(0, Math.min(1, t));
  return clamped < 0.5
    ? 4 * clamped * clamped * clamped
    : 1 - Math.pow(-2 * clamped + 2, 3) / 2;
}

export function easeLinear(t: number): number {
  return Math.max(0, Math.min(1, t));
}
