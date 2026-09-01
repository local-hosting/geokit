import { _resetRegistries as resetAPIRegistries } from '../src/providers/registry';
import { _resetGeokitPlugins } from '../plugin';
import { resetCapabilityRouterReady } from '../src/providers/capability-router-rebuild';

/** Reset service registry, plugin registrar, and capability router (tests). */
export function resetGeokitServiceRegistries(): void {
  resetAPIRegistries();
  _resetGeokitPlugins();
  resetCapabilityRouterReady();
}

export { resetAPIRegistries, _resetGeokitPlugins, resetCapabilityRouterReady };
