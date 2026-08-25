import { _resetRegistries as resetAPIRegistries } from '../services/registry.js';
import { _resetGeokitPlugins } from '../plugin.js';
import { resetCapabilityRouterReady } from '../services/capability-router-rebuild.js';

/** Reset service registry, plugin registrar, and capability router (tests). */
export function resetGeokitServiceRegistries(): void {
  resetAPIRegistries();
  _resetGeokitPlugins();
  resetCapabilityRouterReady();
}

export { resetAPIRegistries, _resetGeokitPlugins, resetCapabilityRouterReady };
