import { describe, expect, it, vi } from 'vitest';
import { syncSharedPointGlowPaint } from '../../../src/utils/shared-point-heal';

describe('syncSharedPointGlowPaint', () => {
  it('returns false without throwing when getLayer fails during style swap', async () => {
    const map = {
      getLayer: vi.fn(() => {
        throw new TypeError("Cannot read properties of undefined (reading 'getOwnLayer')");
      }),
      setPaintProperty: vi.fn(),
    };

    await expect(
      syncSharedPointGlowPaint(
        map as never,
        {
          sourceId: 'demo',
          glowLayerId: 'demo-glow',
          pointLayerId: 'demo-points',
        },
        {
          paint: {
            ids: {
              sourceId: 'demo',
              glowLayerId: 'demo-glow',
              pointLayerId: 'demo-points',
            },
            pointColorExpression: ['literal', '#0060df'],
            pointRadiusExpression: ['literal', 4],
          },
        }
      )
    ).resolves.toBe(false);
  });

  it('preserves feature-state hover opacity during heal resync', async () => {
    const setPaintProperty = vi.fn();
    const map = {
      getLayer: vi.fn((id: string) =>
        id === 'demo-glow' || id === 'demo-points' ? {} : null
      ),
      setPaintProperty,
    };

    await syncSharedPointGlowPaint(map as never, {
      sourceId: 'demo',
      glowLayerId: 'demo-glow',
      pointLayerId: 'demo-points',
    }, {
      paint: {
        ids: {
          sourceId: 'demo',
          glowLayerId: 'demo-glow',
          pointLayerId: 'demo-points',
        },
        pointColorExpression: ['literal', '#0060df'],
        pointRadiusExpression: ['literal', 4],
        glowOpacity: 0.4,
      },
      glowHoverOpacity: 0.68,
      useFeatureStateHover: true,
    });

    expect(setPaintProperty).toHaveBeenCalledWith(
      'demo-glow',
      'circle-opacity',
      expect.arrayContaining(['case'])
    );
  });
});
