/**
 * UI provider registry (map backends)
 *
 * MapTiler SDK, Mapbox GL JS, etc. — rendering only.
 * HTTP geocoding/isochrones use @geokit/service/registry (API providers), not this registry.
 */

import type { BaseUIProvider, UIProviderConfig } from './types';

/**
 * UI Providers Registry
 */
const uiProviders = new Map<string, BaseUIProvider>();

/**
 * Currently active UI provider (for backward compatibility with components that don't specify)
 */
let defaultUIProvider: BaseUIProvider | null = null;

/**
 * Global provider configurations
 */
const providerConfigs = new Map<string, UIProviderConfig>();

/**
 * Configure global settings for providers
 * This allows setting API keys/tokens once instead of on each map element
 *
 * @example
 * ```typescript
 * import { configure } from '@geokit/ui';
 *
 * configure({
 *   maptiler: { apiKey: 'YOUR_API_KEY' },
 *   mapbox: { accessToken: 'YOUR_ACCESS_TOKEN' }
 * });
 * ```
 */
export function configure(config: Record<string, UIProviderConfig>): void {
  for (const [provider, providerConfig] of Object.entries(config)) {
    const existing = providerConfigs.get(provider);
    providerConfigs.set(provider, { ...existing, ...providerConfig });
  }
}

/**
 * Get global configuration for a provider
 * @param name - Provider name
 * @returns Provider configuration or undefined
 */
export function getProviderConfig(name: string): UIProviderConfig | undefined {
  return providerConfigs.get(name);
}

/**
 * Register a UI provider (for map rendering)
 * @param name - Provider name (e.g., 'maptiler', 'mapbox')
 * @param provider - Provider instance
 */
export function registerUIProvider(name: string, provider: BaseUIProvider): void {
  uiProviders.set(name, provider);
}

/**
 * Set the default UI provider (for backward compatibility)
 * @param name - Provider name
 * @param config - Provider configuration
 * @returns Initialized provider
 * @throws Error if provider not found or initialization fails
 */
export async function setUIProvider(
  name: string,
  config?: UIProviderConfig
): Promise<BaseUIProvider> {
  const provider = uiProviders.get(name);

  if (!provider) {
    throw new Error(
      `UI Provider "${name}" not found. Available providers: ${Array.from(uiProviders.keys()).join(
        ', '
      )}`
    );
  }

  if (config && Object.keys(config).length > 0) {
    const existing = providerConfigs.get(name);
    providerConfigs.set(name, { ...existing, ...config });
  }

  const mergedConfig = {
    ...providerConfigs.get(name),
    ...config,
  };
  await provider.initialize(Object.keys(mergedConfig).length > 0 ? mergedConfig : {});

  defaultUIProvider = provider;

  return provider;
}

/**
 * Get a specific provider by name and optionally initialize it
 * @param name - Provider name
 * @param config - Optional provider configuration (overrides global config)
 * @returns Provider instance
 * @throws Error if provider not found
 */
export async function getProviderByName(
  name: string,
  config?: UIProviderConfig
): Promise<BaseUIProvider> {
  const provider = uiProviders.get(name);

  if (!provider) {
    throw new Error(
      `UI Provider "${name}" not found. Available providers: ${Array.from(uiProviders.keys()).join(
        ', '
      )}`
    );
  }

  // Merge global config with provided config (provided config takes precedence)
  const globalConfig = providerConfigs.get(name);
  const finalConfig = { ...globalConfig, ...config };

  if (Object.keys(finalConfig).length > 0) {
    await provider.initialize(finalConfig);
  }

  return provider;
}

/**
 * Get the default UI provider (for backward compatibility)
 * @returns Default UI provider
 * @throws Error if no default provider is set
 */
export function getUIProvider(): BaseUIProvider {
  if (!defaultUIProvider) {
    throw new Error(
      'No default UI provider is set. Call setUIProvider() first or specify a provider explicitly.'
    );
  }

  return defaultUIProvider;
}

/**
 * Get a UI provider by name without initializing
 * @param name - Provider name
 * @returns Provider instance or null if not found
 */
export function getUIProviderByName(name: string): BaseUIProvider | null {
  return uiProviders.get(name) || null;
}

/**
 * Get all registered UI provider names
 * @returns Array of provider names
 */
export function getRegisteredUIProviders(): string[] {
  return Array.from(uiProviders.keys());
}

/**
 * Clear all UI providers (useful for testing)
 */
export function clearUIProviders(): void {
  uiProviders.clear();
  defaultUIProvider = null;
  providerConfigs.clear();
}

// For testing: alias for clearUIProviders
export function _resetRegistries(): void {
  clearUIProviders();
}
