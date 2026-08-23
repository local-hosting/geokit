/**
 * Plugin registration — wraps API providers from @geokit/plugin-* packages.
 * A plugin is metadata + factory; registerGeokitPlugin() installs the BaseAPIProvider.
 */

import type { APICapability, BaseAPIProvider, MapProviderConfig } from './providers/types.js';
import {
  getAPIProvider,
  initAPIProvider,
  registerAPIProvider,
  removeAPIProvider,
} from './providers/registry.js';
import { _notifyPluginChainRebuild } from './providers/capability-router-rebuild.js';
import type { CapabilityRouterEnvOverrides } from './types/api-composite.js';

export type GeokitPluginChainPosition = 'prepend' | 'append';

export interface GeokitAPIPlugin {
  name: string;
  capabilities: APICapability[];
  createProvider: () => BaseAPIProvider;
  /** Where to insert this provider in composite fallback chains (default append). */
  chain?: Partial<Record<APICapability, GeokitPluginChainPosition>>;
}

export interface GeokitPluginRegistration {
  plugin: GeokitAPIPlugin;
  provider: BaseAPIProvider;
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
  plugin: GeokitAPIPlugin,
  config?: MapProviderConfig
): Promise<BaseAPIProvider> {
  if (getAPIProvider(plugin.name)) {
    throw new Error(`Geokit plugin "${plugin.name}" is already registered`);
  }

  const provider = plugin.createProvider();
  registerAPIProvider(plugin.name, provider);

  const registration: GeokitPluginRegistration = {
    plugin,
    provider,
    initialized: false,
  };
  pluginRegistrations.push(registration);

  if (config) {
    await initAPIProvider(plugin.name, config);
    registration.initialized = true;
  }

  notifyPluginChange();
  return provider;
}

/** Initialize a registered plugin (idempotent). */
export async function initGeokitPlugin(
  name: string,
  config: MapProviderConfig = {}
): Promise<BaseAPIProvider> {
  const registration = pluginRegistrations.find((entry) => entry.plugin.name === name);
  if (!registration) {
    throw new Error(`Geokit plugin "${name}" is not registered`);
  }

  if (!registration.initialized) {
    await initAPIProvider(name, config);
    registration.initialized = true;
    notifyPluginChange();
  }

  const provider = getAPIProvider(name);
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
  removeAPIProvider(name);
  notifyPluginChange();
}

export function getGeokitPluginRegistrations(): readonly GeokitPluginRegistration[] {
  return pluginRegistrations;
}

export function applyPluginsToCapabilityChains(
  chains: Partial<Record<APICapability, BaseAPIProvider[]>>
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
  plugin: GeokitAPIPlugin,
  resolveConfig: (overrides?: O) => MapProviderConfig | null | undefined
): (overrides?: O) => Promise<void> {
  return async (overrides) => {
    const config = resolveConfig(overrides);
    if (!config) {
      return;
    }

    if (getAPIProvider(plugin.name)) {
      await initAPIProvider(plugin.name, config);
      return;
    }

    await registerGeokitPlugin(plugin, config);
  };
}

export function createOptionalPluginRegistrar(
  plugin: GeokitAPIPlugin,
  config?: MapProviderConfig
): () => Promise<void> {
  return async () => {
    if (getAPIProvider(plugin.name)) {
      if (config) {
        await initAPIProvider(plugin.name, config);
      }
      return;
    }

    await registerGeokitPlugin(plugin, config);
  };
}
