import { GEOKIT_ENV_ALIAS_GROUPS } from '../../types/env.js';
import type { GeokitEnv } from '../../types/env.js';
import { firstEnv } from './primitives.js';

export function applyGeokitEnvAliases(env: GeokitEnv): GeokitEnv {
  const result = { ...env };

  for (const group of GEOKIT_ENV_ALIAS_GROUPS) {
    const value = firstEnv(result, group.sources);
    if (!value) continue;
    for (const target of group.targets) {
      if (!result[target]?.trim()) {
        result[target] = value;
      }
    }
  }

  return result;
}
