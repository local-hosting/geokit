import type { APICapability, BaseAPIProvider } from './types.js';
import { createCompositeAPIProvider } from './composite-provider.js';
import {
  applyPluginsToCapabilityChains,
  getGeokitPluginRegistrations,
} from '../plugin.js';
import { getCapabilityRouter, initAPIProvider, registerCapabilityRouter } from './registry.js';

let capabilityRoutersReady: Promise<void> | null = null;

async function initRegisteredPlugins(): Promise<void> {
  for (const registration of getGeokitPluginRegistrations()) {
    if (registration.initialized) {
      continue;
    }
    await initAPIProvider(registration.plugin.name, {});
    registration.initialized = true;
  }
}

function registerCompositeRouters(chains: Partial<Record<APICapability, BaseAPIProvider[]>>): void {
  if (chains.geocoding?.length) {
    registerCapabilityRouter(
      'geocoding',
      createCompositeAPIProvider({
        name: 'composite:geocoding',
        chains: { geocoding: chains.geocoding },
      })
    );
  }

  if (chains.placeSearch?.length) {
    registerCapabilityRouter(
      'placeSearch',
      createCompositeAPIProvider({
        name: 'composite:placeSearch',
        chains: { placeSearch: chains.placeSearch },
      })
    );
  }

  if (chains.isochrone?.length) {
    registerCapabilityRouter(
      'isochrone',
      createCompositeAPIProvider({
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
  const chains: Partial<Record<APICapability, BaseAPIProvider[]>> = {};
  applyPluginsToCapabilityChains(chains);
  registerCompositeRouters(chains);
  markCapabilityRoutersReady();
}

/** @internal setup-capability-routers plugin hook */
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
