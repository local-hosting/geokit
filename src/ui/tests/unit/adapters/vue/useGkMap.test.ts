import { describe, expect, it, vi } from 'vitest';
import { createApp, defineComponent, ref, type Ref } from 'vue';
import type { GkMapElement } from '../../../../src/adapters/shared/types';
import { useGkMap } from '../../../../src/adapters/vue/useGkMap';

function mountUseGkMap(elementRef: Ref<GkMapElement | null>) {
  let api!: ReturnType<typeof useGkMap>;
  const Comp = defineComponent({
    setup() {
      api = useGkMap(elementRef);
      return () => null;
    },
  });
  const app = createApp(Comp);
  const host = document.createElement('div');
  app.mount(host);
  return {
    api,
    teardown() {
      app.unmount();
      host.remove();
    },
  };
}

describe('useGkMap', () => {
  it('syncs ready state when the element already has a map (e.g. after Vue HMR)', () => {
    const hidePlaceholder = vi.fn();
    const existingMap = { id: 'map-1' };
    const el = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      getMap: () => existingMap,
      hidePlaceholder,
    } as unknown as GkMapElement;

    const elRef = ref<GkMapElement | null>(el);
    const ctx = mountUseGkMap(elRef);

    expect(ctx.api.isReady.value).toBe(true);
    expect(ctx.api.mapInstance.value).toStrictEqual(existingMap);
    expect(hidePlaceholder).toHaveBeenCalledOnce();

    ctx.teardown();
  });
});
