import { describe, expect, it, vi } from 'vitest';
import { createMarker, type MarkerPreset } from '../../../src/utils/markers/factory';

type DemoIds = { sourceId: string; rootLayerId: string };
type DemoVariant = 'disk' | 'pin';
type DemoPaint = { ids: DemoIds; color: string };

describe('createMarker', () => {
  const ids: DemoIds = { sourceId: 'demo-src', rootLayerId: 'demo-root' };

  const preset: MarkerPreset<DemoVariant, DemoIds, DemoPaint> = {
    presetId: 'demo',
    inventory: {
      layerStack: () => ['demo-root', 'demo-root-hover'],
      sourceStack: () => ['demo-src'],
    },
    paint: {
      build: (layerIds, { fallbackAccent }) => ({
        ids: layerIds,
        color: String(fallbackAccent),
      }),
    },
    features: {
      variantFrom: (props) => (props?.shape === 'pin' ? 'pin' : 'disk'),
      accentFrom: (props, fb) => (typeof props?.color === 'string' ? props.color : fb) || '#000',
    },
    states: {
      apply(map, layerIds, state) {
        if (state.phase !== 'selected') return;
        map.setPaintProperty?.(
          layerIds.rootLayerId,
          'circle-color',
          `${state.variant}:${state.accentColor}`
        );
      },
    },
  };

  it('composes a preset into a marker', () => {
    const marker = createMarker(preset, { ids, fallbackAccent: '#111' });
    expect(marker.layerStack()).toEqual(['demo-root', 'demo-root-hover']);
    const setPaintProperty = vi.fn();
    marker.applyState({ setPaintProperty } as never, {
      phase: 'selected',
      variant: 'disk',
      accentColor: '#f00',
    });
    expect(setPaintProperty).toHaveBeenCalledWith('demo-root', 'circle-color', 'disk:#f00');
  });
});