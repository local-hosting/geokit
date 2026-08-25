import type { ServiceCapability } from './types.js';
import type { Service } from './service.js';
import { createCompositeService } from './composite-service.js';
import {
  applyPluginsToCapabilityChains,
  getGeokitPluginRegistrations,
} from '../plugin.js';
import { getCapabilityRouter, initService, registerCapabilityRouter } from './registry.js';

let capabilityRoutersReady: Promise<void> | null = null;

async function initRegisteredPlugins(): Promise<void> {
  for (const registration of getGeokitPluginRegistrations()) {
    if (registration.initialized) {
      continue;
    }
    await initService(registration.plugin.name, {});
    registration.initialized = true;
  }
}

function registerCompositeRouters(chains: Partial<Record<ServiceCapability, Service[]>>): void {
  if (chains.geocoding?.length) {
    registerCapabilityRouter(
      'geocoding',
      createCompositeService({
        name: 'composite:geocoding',
        chains: { geocoding: chains.geocoding },
      })
    );
  }

  if (chains.placeSearch?.length) {
    registerCapabilityRouter(
      'placeSearch',
      createCompositeService({
        name: 'composite:placeSearch',
        chains: { placeSearch: chains.placeSearch },
      })
    );
  }

  if (chains.isochrone?.length) {
    registerCapabilityRouter(
      'isochrone',
      createCompositeService({
        name: 'composite:isochrone',
        chains: { isochrone: chains.isochrone },
      })
    );
  }
}

/** Rebuild composite routers from registered plugins. */
export function markCapabilityRoutersReady(): void {
  capabilityRoutersReady = Promise.resolve();
}

export async function rebuildCapabilityRouters(): Promise<void> {
  await initRegisteredPlugins();
  const chains: Partial<Record<ServiceCapability, Service[]>> = {};
  applyPluginsToCapabilityChains(chains);
  registerCompositeRouters(chains);
  markCapabilityRoutersReady();
}

/** @internal builtins plugin hook */
export function _notifyPluginChainRebuild(): void {
  if (!capabilityRoutersReady) {
    return;
  }
  capabilityRoutersReady = rebuildCapabilityRouters().catch((error) => {
    capabilityRoutersReady = null;
    throw error;
  });
}

/** @internal test helper */
export function resetCapabilityRouterReady(): void {
  capabilityRoutersReady = null;
}

export { getCapabilityRouter };
