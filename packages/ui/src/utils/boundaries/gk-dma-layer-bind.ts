/**
 * Wire CDN JWT + stacking on declarative gk-layer[dataset=dma] maps.
 */

export type GkDmaLayerBindDeps = {
  ensureCdnAccess: () => Promise<boolean>;
  wireJwtOnMap: (gkMap: unknown) => Promise<void>;
  bindLayerStacking: (gkMap: unknown) => void;
  findDmaLayer: (gkMap: unknown) => unknown;
  onCdnReadyEvent: string;
  traceLog?: (stage: string, detail?: Record<string, unknown>) => void;
  warnLog?: (message: string, detail?: Record<string, unknown>) => void;
};

export function createGkDmaLayerBinder(deps: GkDmaLayerBindDeps) {
  let boundMap: unknown = null;

  async function bindMap(gkMap: unknown): Promise<boolean> {
    boundMap = gkMap;
    deps.traceLog?.('gk dma bind start');

    const cdnAccess = await deps.ensureCdnAccess();
    if (!cdnAccess) {
      deps.warnLog?.('gk dma bind: CDN access unavailable', {
        hint: 'check cdn identity token wiring',
      });
      return false;
    }

    await deps.wireJwtOnMap(gkMap);
    deps.bindLayerStacking(gkMap);
    const loaded = !!deps.findDmaLayer(gkMap);
    deps.traceLog?.('gk dma bind complete', { loaded });
    return loaded;
  }

  const onCdnReady = () => {
    if (!boundMap) return;
    void bindMap(boundMap);
  };

  function attach(): void {
    document.addEventListener(deps.onCdnReadyEvent, onCdnReady);
  }

  function detach(): void {
    document.removeEventListener(deps.onCdnReadyEvent, onCdnReady);
    boundMap = null;
  }

  return { bindMap, attach, detach, setBoundMap: (gkMap: unknown) => { boundMap = gkMap; } };
}
