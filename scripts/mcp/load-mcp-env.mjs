/**
 * Load packages/geokit/.env and mirror keys the MCP server expects.
 * MCP env from Cursor wins over .env when both are set.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import dotenv from 'dotenv';

const ALIAS_GROUPS = [
  {
    sources: ['MAPTILER_KEY', 'GEOKIT_MAPTILER_KEY', 'GEOKIT_MAP_API_KEY', 'MAP_API_KEY'],
    targets: ['MAPTILER_KEY', 'GEOKIT_MAP_API_KEY', 'GEOKIT_MAPTILER_KEY'],
  },
  {
    sources: [
      'MAPBOX_TOKEN',
      'MAPBOX_ACCESS_TOKEN',
      'GEOKIT_MAPBOX_KEY',
      'GEOKIT_ROUTING_TOKEN',
      'ROUTING_TOKEN',
    ],
    targets: ['MAPBOX_TOKEN', 'GEOKIT_ROUTING_TOKEN', 'ROUTING_TOKEN'],
  },
  {
    sources: ['FOURSQUARE_API_KEY', 'FSQ_API_KEY', 'GEOKIT_FOURSQUARE_KEY'],
    targets: ['FOURSQUARE_API_KEY', 'FSQ_API_KEY'],
  },
  {
    sources: ['GLOBE_CDN_JWT', 'GEOKIT_GLOBE_CDN_JWT', 'FW_GLOBE_CDN_JWT'],
    targets: ['GLOBE_CDN_JWT', 'GEOKIT_GLOBE_CDN_JWT', 'FW_GLOBE_CDN_JWT'],
  },
  {
    sources: ['GLOBE_CDN_JWT_SECRET', 'GEOKIT_GLOBE_CDN_JWT_SECRET'],
    targets: ['GLOBE_CDN_JWT_SECRET', 'GEOKIT_GLOBE_CDN_JWT_SECRET'],
  },
  {
    sources: ['FW_GLOBE_CDN_URL', 'GLOBE_CDN_URL', 'GEOKIT_GLOBE_CDN_URL'],
    targets: ['FW_GLOBE_CDN_URL', 'GLOBE_CDN_URL', 'GEOKIT_GLOBE_CDN_URL'],
  },
];

function firstSet(env, keys) {
  for (const key of keys) {
    const value = env[key]?.trim();
    if (value) return value;
  }
  return undefined;
}

function applyAliasGroups(env) {
  for (const group of ALIAS_GROUPS) {
    const value = firstSet(env, group.sources);
    if (!value) continue;
    for (const target of group.targets) {
      if (!env[target]?.trim()) {
        env[target] = value;
      }
    }
  }
}

/**
 * @param {string} geokitRoot
 * @param {NodeJS.ProcessEnv} [baseEnv]
 * @returns {NodeJS.ProcessEnv}
 */
function mergeDotenvFile(env, dotenvPath) {
  if (!existsSync(dotenvPath)) return;
  const parsed = dotenv.parse(readFileSync(dotenvPath));
  for (const [key, value] of Object.entries(parsed)) {
    if (!env[key]?.trim()) {
      env[key] = value;
    }
  }
}

export function loadGeokitMcpEnv(geokitRoot, baseEnv = process.env) {
  const env = { ...baseEnv };
  const monorepoRoot = join(geokitRoot, '..', '..');

  mergeDotenvFile(env, join(geokitRoot, '.env'));
  mergeDotenvFile(env, join(monorepoRoot, '.env'));

  if (!env.FW_GLOBE_CDN_URL?.trim() && !env.GLOBE_CDN_URL?.trim() && !env.GEOKIT_GLOBE_CDN_URL?.trim()) {
    env.FW_GLOBE_CDN_URL = 'https://mapto.link';
  }

  applyAliasGroups(env);
  return env;
}
