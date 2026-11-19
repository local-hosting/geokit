/**
 * Lazy UI provider registration — keeps unused map SDKs out of the initial chunk.
 */

import { getUIProviderByName, registerUIProvider } from './registry';

export async function ensureMaptilerUIProviderRegistered(): Promise<void> {
  if (getUIProviderByName('maptiler')) return;
  const { MapTilerUIProvider } = await import('./maptiler-provider');
  registerUIProvider('maptiler', new MapTilerUIProvider());
}