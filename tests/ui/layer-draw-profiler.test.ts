import { describe, expect, it, vi } from 'vitest';
import { attachLayerDrawProfiler } from '../../src/ui/debug/layer-draw-profiler';

describe('attachLayerDrawProfiler', () => {
  it('no-ops when disabled', () => {
    const cleanup = attachLayerDrawProfiler({}, { enabled: false });
    expect(typeof cleanup).toBe('function');
    cleanup();
  });

  it('calls onSkipped when painter missing', () => {
    const onSkipped = vi.fn();
    attachLayerDrawProfiler({}, { enabled: true, onSkipped });
    expect(onSkipped).toHaveBeenCalledWith('painter.renderLayer unavailable');
  });
});
