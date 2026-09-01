// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createGkDmaLayerBinder } from '../../../src/utils/boundaries/gk-dma-layer-bind';

const EVENT = 'gk-dma-cdn-ready';

function createDeps(overrides: Partial<Parameters<typeof createGkDmaLayerBinder>[0]> = {}) {
  return {
    ensureCdnAccess: vi.fn(async () => true),
    wireJwtOnMap: vi.fn(async () => undefined),
    bindLayerStacking: vi.fn(),
    findDmaLayer: vi.fn(() => ({ dataset: 'dma' })),
    onCdnReadyEvent: EVENT,
    traceLog: vi.fn(),
    warnLog: vi.fn(),
    ...overrides,
  };
}

describe('createGkDmaLayerBinder', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('binds JWT and stacking when CDN access is available', async () => {
    const deps = createDeps();
    const binder = createGkDmaLayerBinder(deps);
    const gkMap = { id: 'map-1' };

    await expect(binder.bindMap(gkMap)).resolves.toBe(true);

    expect(deps.ensureCdnAccess).toHaveBeenCalledOnce();
    expect(deps.wireJwtOnMap).toHaveBeenCalledWith(gkMap);
    expect(deps.bindLayerStacking).toHaveBeenCalledWith(gkMap);
    expect(deps.traceLog).toHaveBeenCalledWith('gk dma bind complete', { loaded: true });
  });

  it('returns false and warns when CDN access is unavailable', async () => {
    const deps = createDeps({
      ensureCdnAccess: vi.fn(async () => false),
    });
    const binder = createGkDmaLayerBinder(deps);

    await expect(binder.bindMap({ id: 'map-2' })).resolves.toBe(false);

    expect(deps.wireJwtOnMap).not.toHaveBeenCalled();
    expect(deps.bindLayerStacking).not.toHaveBeenCalled();
    expect(deps.warnLog).toHaveBeenCalledWith('gk dma bind: CDN access unavailable', {
      hint: 'check cdn identity token wiring',
    });
  });

  it('reports loaded=false when no DMA layer is present', async () => {
    const deps = createDeps({
      findDmaLayer: vi.fn(() => null),
    });
    const binder = createGkDmaLayerBinder(deps);

    await expect(binder.bindMap({ id: 'map-3' })).resolves.toBe(false);
    expect(deps.traceLog).toHaveBeenCalledWith('gk dma bind complete', { loaded: false });
  });

  it('re-binds on CDN ready event after attach', async () => {
    const deps = createDeps();
    const binder = createGkDmaLayerBinder(deps);
    const gkMap = { id: 'map-4' };

    binder.setBoundMap(gkMap);
    binder.attach();

    document.dispatchEvent(new CustomEvent(EVENT));
    await vi.waitFor(() => {
      expect(deps.wireJwtOnMap).toHaveBeenCalledWith(gkMap);
    });

    binder.detach();
    deps.wireJwtOnMap.mockClear();
    document.dispatchEvent(new CustomEvent(EVENT));
    expect(deps.wireJwtOnMap).not.toHaveBeenCalled();
  });

  it('ignores CDN ready event when no map is bound', async () => {
    const deps = createDeps();
    const binder = createGkDmaLayerBinder(deps);

    binder.attach();
    document.dispatchEvent(new CustomEvent(EVENT));

    await Promise.resolve();
    expect(deps.ensureCdnAccess).not.toHaveBeenCalled();
    binder.detach();
  });
});
