/**
 * UI Provider Registry
 * 
 * Manages UI providers for map rendering
 * Only one UI provider is active at a time
 */

import type { BaseUIProvider, MapProviderConfig } from './types';

/**
 * UI Providers Registry
 */
const uiProviders = new Map<string, BaseUIProvider>();

/**
 * Currently active UI provider
 */
let currentUIProvider: BaseUIProvider | null = null;

/**
 * Register a UI provider (for map rendering)
 * @param name - Provider name (e.g., 'maptiler', 'mapbox')
 * @param provider - Provider instance
 */
export function registerUIProvider(name: string, provider: BaseUIProvider): void {
  uiProviders.set(name, provider);
}

/**
 * Set the active UI provider
 * @param name - Provider name
 * @param config - Provider configuration
 * @returns Initialized provider
 * @throws Error if provider not found or initialization fails
 */
export async function setUIProvider(
  name: string,
  config?: MapProviderConfig
): Promise<BaseUIProvider> {
  const provider = uiProviders.get(name);

  if (!provider) {
    throw new Error(
      `UI Provider "${name}" not found. Available providers: ${Array.from(
        uiProviders.keys()
      ).join(', ')}`
    );
  }

  // Initialize the provider
  await provider.initialize(config || {});

  currentUIProvider = provider;

  return provider;
}

/**
 * Get the current active UI provider
 * @returns Current UI provider
 * @throws Error if no UI provider is set
 */
export function getUIProvider(): BaseUIProvider {
  if (!currentUIProvider) {
    throw new Error(
      'No UI provider is set. Call setUIProvider() first.'
    );
  }

  return currentUIProvider;
}

/**
 * Get a UI provider by name
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
  currentUIProvider = null;
}
