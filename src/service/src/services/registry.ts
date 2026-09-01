/**
 * Service registry — HTTP capabilities (geocoding, place search, isochrones).
 * Not the UI map backend registry — see geokit src/ui/providers/registry.ts.
 */

import type { ServiceCapability, ServiceConfig } from './types';
import type { Service } from './service';

const services = new Map<string, Service>();
const capabilityIndex = new Map<ServiceCapability, Service[]>();
const capabilityRouters = new Map<ServiceCapability, Service>();

export function registerService(name: string, service: Service): void {
  services.set(name, service);

  for (const capability of service.getCapabilities()) {
    const chain = capabilityIndex.get(capability) ?? [];
    chain.push(service);
    capabilityIndex.set(capability, chain);
  }
}

export async function initService(name: string, config: ServiceConfig = {}): Promise<Service> {
  const service = services.get(name);
  if (!service) {
    throw new Error(
      `Service "${name}" not found. Available: ${Array.from(services.keys()).join(', ')}`
    );
  }

  await service.initialize(config);
  return service;
}

export function getService(name: string): Service | null {
  return services.get(name) ?? null;
}

export function removeService(name: string): void {
  const service = services.get(name);
  if (!service) {
    return;
  }

  services.delete(name);

  for (const [capability, chain] of capabilityIndex.entries()) {
    const next = chain.filter((entry) => entry !== service);
    if (next.length > 0) {
      capabilityIndex.set(capability, next);
    } else {
      capabilityIndex.delete(capability);
    }
  }
}

export function _resetRegistries(): void {
  services.clear();
  capabilityIndex.clear();
  capabilityRouters.clear();
}

export function registerCapabilityRouter(capability: ServiceCapability, router: Service): void {
  capabilityRouters.set(capability, router);
}

export function getCapabilityRouter(capability: ServiceCapability): Service | null {
  return capabilityRouters.get(capability) ?? null;
}

export function getServiceForCapability(capability: ServiceCapability): Service | null {
  const router = capabilityRouters.get(capability);
  if (router) {
    return router;
  }
  const chain = capabilityIndex.get(capability);
  return chain && chain.length > 0 ? chain[0]! : null;
}

export function getServicesForCapability(capability: ServiceCapability): Service[] {
  return capabilityIndex.get(capability) ?? [];
}

export function isCapabilitySupported(capability: ServiceCapability): boolean {
  const chain = capabilityIndex.get(capability);
  return !!chain && chain.length > 0;
}

export function getRegisteredServices(): string[] {
  return Array.from(services.keys());
}

export function getSupportedCapabilities(): ServiceCapability[] {
  return Array.from(capabilityIndex.keys());
}

export function clearServices(): void {
  services.clear();
  capabilityIndex.clear();
  capabilityRouters.clear();
}
