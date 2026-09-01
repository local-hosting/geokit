import { describe, expect, it } from 'vitest';
import { effectScope, ref } from 'vue';
import { useGkMapStyle } from '../../../../src/adapters/vue/useGkMapStyle';
import type { GkMapElement } from '../../../../src/adapters/shared/types';

describe('useGkMapStyle', () => {
  it('sets map-style when style ref changes', async () => {
    const scope = effectScope();
    const el = document.createElement('gk-map') as GkMapElement;

    await scope.run(async () => {
      const mapElement = ref<GkMapElement | null>(el);
      const mapStyle = ref('maptiler://light');
      useGkMapStyle(mapElement, mapStyle);

      expect(el.getAttribute('map-style')).toBe('maptiler://light');

      mapStyle.value = 'maptiler://dark';
      await Promise.resolve();
      expect(el.getAttribute('map-style')).toBe('maptiler://dark');
    });

    scope.stop();
  });
});
