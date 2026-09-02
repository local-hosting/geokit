/**
 * Plugin registration — wraps API providers from @twinfile/geokit/* service packages packages.
 * A plugin is metadata + factory; registerGeokitPlugin() installs the Service.
 */

import type { ServiceCapability, ServiceConfig } from './services/types';
import type { Service } from './services/service';
import {
  getService,
  initService,
  registerService,
  removeService,
} from './services/registry';
import { _notifyPluginChainRebuild } from './services/capability-router-rebuild';
import type { CapabilityRouterEnvOverrides } from './types/api-composite';

export type GeokitPluginChainPosition = 'prepend' | 'append';

export interface GeokitServicePlugin {
  name: string;
  capabilities: ServiceCapability[];
  createService: () => Service;
  /** Where to insert this provider in composite fallback chains (default append). */
  chain?: Partial<Record<ServiceCapability, GeokitPluginChainPosition>>;
}

export interface GeokitPluginRegistration {
  plugin: GeokitServicePlugin;
  provider: Service;
  initialized: boolean;
}

const pluginRegistrations: GeokitPluginRegistration[] = [];
function notifyPluginChange(): void {
  _notifyPluginChainRebuild();
}

/**
 * Register an optional API provider plugin and insert it into capability chains.
 * Pass config to initialize immediately (e.g. api keys).
 */
export async function registerGeokitPlugin(
  plugin: GeokitServicePlugin,
  config?: ServiceConfig
): Promise<Service> {
  if (getService(plugin.name)) {
    throw new Error(`Geokit plugin "${plugin.name}" is already registered`);
  }

  const provider = plugin.createService();
  registerService(plugin.name, provider);

  const registration: GeokitPluginRegistration = {
    plugin,
    provider,
    initialized: false,
  };
  pluginRegistrations.push(registration);

  if (config) {
    await initService(plugin.name, config);
    registration.initialized = true;
  }

  notifyPluginChange();
  return provider;
}

/** Initialize a registered plugin (idempotent). */
export async function initGeokitPlugin(
  name: string,
  config: ServiceConfig = {}
): Promise<Service> {
  const registration = pluginRegistrations.find((entry) => entry.plugin.name === name);
  if (!registration) {
    throw new Error(`Geokit plugin "${name}" is not registered`);
  }

  if (!registration.initialized) {
    await initService(name, config);
    registration.initialized = true;
    notifyPluginChange();
  }

  const provider = getService(name);
  if (!provider) {
    throw new Error(`Geokit plugin "${name}" failed to initialize`);
  }
  return provider;
}

/** Remove a plugin from the registry and rebuild capability chains. */
export function unregisterGeokitPlugin(name: string): void {
  const index = pluginRegistrations.findIndex((entry) => entry.plugin.name === name);
  if (index === -1) {
    return;
  }

  pluginRegistrations.splice(index, 1);
  removeService(name);
  notifyPluginChange();
}

export function getGeokitPluginRegistrations(): readonly GeokitPluginRegistration[] {
  return pluginRegistrations;
}

export function applyPluginsToCapabilityChains(
  chains: Partial<Record<ServiceCapability, Service[]>>
): void {
  for (const { plugin, provider } of pluginRegistrations) {
    const capabilities = new Set(plugin.capabilities);
    for (const capability of provider.getCapabilities()) {
      if (!capabilities.has(capability)) {
        continue;
      }

      const position = plugin.chain?.[capability] ?? 'append';
      const chain = chains[capability] ?? [];
      if (position === 'prepend') {
        chain.unshift(provider);
      } else {
        chain.push(provider);
      }
      chains[capability] = chain;
    }
  }
}

/** @internal test helper */
export function _resetGeokitPlugins(): void {
  pluginRegistrations.length = 0;
}

export function createKeyedPluginRegistrar<O extends CapabilityRouterEnvOverrides = CapabilityRouterEnvOverrides>(
  plugin: GeokitServicePlugin,
  resolveConfig: (overrides?: O) => ServiceConfig | null | undefined
): (overrides?: O) => Promise<void> {
  return async (overrides) => {
    const config = resolveConfig(overrides);
    if (!config) {
      return;
    }

    if (getService(plugin.name)) {
      await initService(plugin.name, config);
      return;
    }

    await registerGeokitPlugin(plugin, config);
  };
}

export function createOptionalPluginRegistrar(
  plugin: GeokitServicePlugin,
  config?: ServiceConfig
): () => Promise<void> {
  return async () => {
    if (getService(plugin.name)) {
      if (config) {
        await initService(plugin.name, config);
      }
      return;
    }

    await registerGeokitPlugin(plugin, config);
  };
}
