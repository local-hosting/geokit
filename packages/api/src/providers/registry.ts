/**
 * API Provider Registry
 *
 * Manages API providers with capability-based routing
 * Multiple API providers can be active simultaneously
 */

import type { BaseAPIProvider, APICapability, MapProviderConfig } from './types';

/**
 * API Providers Registry
 */
const apiProviders = new Map<string, BaseAPIProvider>();

/**
 * Capability Index - maps capabilities to providers that support them
 */
const capabilityIndex = new Map<APICapability, BaseAPIProvider[]>();

/**
 * Explicit capability routers (composite / fallback chains).
 * Take precedence over the first registered provider in capabilityIndex.
 */
const capabilityRouters = new Map<APICapability, BaseAPIProvider>();

/**
 * Register an API provider (for services)
 * Automatically indexes the provider's capabilities
 * @param name - Provider name
 * @param provider - Provider instance
 */
export function registerAPIProvider(name: string, provider: BaseAPIProvider): void {
  apiProviders.set(name, provider);

  // Index capabilities for routing
  const capabilities = provider.getCapabilities();
  capabilities.forEach((capability) => {
    const providers = capabilityIndex.get(capability) || [];
    providers.push(provider);
    capabilityIndex.set(capability, providers);
  });
}

/**
 * Initialize an API provider
 * Multiple API providers can be active simultaneously
 * @param name - Provider name
 * @param config - Provider configuration
 * @returns Initialized provider
 * @throws Error if provider not found or initialization fails
 */
export async function initAPIProvider(
  name: string,
  config?: MapProviderConfig
): Promise<BaseAPIProvider> {
  const provider = apiProviders.get(name);

  if (!provider) {
    throw new Error(
      `API Provider "${name}" not found. Available providers: ${Array.from(
        apiProviders.keys()
      ).join(', ')}`
    );
  }

  // Initialize the provider
  await provider.initialize(config || {});

  return provider;
}

/**
 * Get an API provider by name
 * @param name - Provider name
 * @returns Provider instance or null if not found
 */
export function getAPIProvider(name: string): BaseAPIProvider | null {
  return apiProviders.get(name) || null;
}

/**
 * Remove a registered API provider and rebuild the capability index.
 */
export function removeAPIProvider(name: string): void {
  const provider = apiProviders.get(name);
  if (!provider) {
    return;
  }

  apiProviders.delete(name);

  for (const [capability, providers] of capabilityIndex.entries()) {
    const next = providers.filter((entry) => entry !== provider);
    if (next.length > 0) {
      capabilityIndex.set(capability, next);
    } else {
      capabilityIndex.delete(capability);
    }
  }
}

// For testing: reset registries
export function _resetRegistries(): void {
  apiProviders.clear();
  capabilityIndex.clear();
  capabilityRouters.clear();
}

/**
 * Get a provider that supports a specific capability
 * Returns the first provider that supports the capability
 * @param capability - The capability to look for
 * @returns Provider instance or null if no provider supports the capability
 */
export function registerCapabilityRouter(capability: APICapability, router: BaseAPIProvider): void {
  capabilityRouters.set(capability, router);
}

export function getCapabilityRouter(capability: APICapability): BaseAPIProvider | null {
  return capabilityRouters.get(capability) ?? null;
}

export function getProviderForCapability(capability: APICapability): BaseAPIProvider | null {
  const router = capabilityRouters.get(capability);
  if (router) {
    return router;
  }
  const providers = capabilityIndex.get(capability);
  return providers && providers.length > 0 ? providers[0] : null;
}

/**
 * Get all providers that support a specific capability
 * @param capability - The capability to look for
 * @returns Array of providers (empty if none found)
 */
export function getProvidersForCapability(capability: APICapability): BaseAPIProvider[] {
  return capabilityIndex.get(capability) || [];
}

/**
 * Check if a capability is supported by any registered provider
 * @param capability - The capability to check
 * @returns True if at least one provider supports the capability
 */
export function isCapabilitySupported(capability: APICapability): boolean {
  const providers = capabilityIndex.get(capability);
  return !!providers && providers.length > 0;
}

/**
 * Get all registered API provider names
 * @returns Array of provider names
 */
export function getRegisteredAPIProviders(): string[] {
  return Array.from(apiProviders.keys());
}

/**
 * Get all supported capabilities across all registered API providers
 * @returns Array of unique capabilities
 */
export function getSupportedCapabilities(): APICapability[] {
  return Array.from(capabilityIndex.keys());
}

/**
 * Clear all API providers (useful for testing)
 */
export function clearAPIProviders(): void {
  apiProviders.clear();
  capabilityIndex.clear();
  capabilityRouters.clear();
}
