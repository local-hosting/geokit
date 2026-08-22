import { describe, expect, it } from 'vitest';
import { createApp, defineComponent, ref, type Ref } from 'vue';
import { useGkMapMount } from '../../../../src/adapters/vue/useGkMapMount.js';

function mountUseGkMapMount(
  setupFn: (api: ReturnType<typeof useGkMapMount>) => void,
  options: Parameters<typeof useGkMapMount>[1] = {}
) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const containerRef = ref(container) as Ref<HTMLElement | null>;
  let api!: ReturnType<typeof useGkMapMount>;

  const Comp = defineComponent({
    setup() {
      api = useGkMapMount(containerRef, options);
      setupFn(api);
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
      container.remove();
    },
  };
}

describe('useGkMapMount', () => {
  it('immediate mode exposes shouldMount true', () => {
    const ctx = mountUseGkMapMount(api => {
      expect(api.shouldMount.value).toBe(true);
    }, { mode: 'immediate' });
    ctx.teardown();
  });

  it('requestRemount forces mount after toggling off', async () => {
    const ctx = mountUseGkMapMount(
      api => {
        expect(api.shouldMount.value).toBe(false);
        api.requestRemount();
      },
      { mode: 'when-visible', visibleStableMs: 0 }
    );

    await new Promise<void>(resolve => queueMicrotask(resolve));
    expect(ctx.api.shouldMount.value).toBe(true);
    ctx.teardown();
  });
});
