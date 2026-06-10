import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { capPolygonCollectionForMapLibre } from '../../src/utils/geojson/boundary-lines';

const statesPath =
  process.env.GEOKIT_TEST_STATES_JSON?.trim() ||
  join(process.cwd(), '..', '..', 'apps', 'cdn', 'build', 'us', 'indexes', 'states.json');

describe('capPolygonCollectionForMapLibre (TX)', () => {
  it.skipIf(!existsSync(statesPath))('preserves recognizable texas ring budget', () => {
    const states = JSON.parse(readFileSync(statesPath, 'utf8'));
    const capped = capPolygonCollectionForMapLibre(states);
    const tx = capped.features.find(
      (f: GeoJSON.Feature) => String(f.properties?.stateCode).toLowerCase() === 'tx'
    );
    const ring = (tx!.geometry as GeoJSON.Polygon).coordinates[0]!;
    expect(ring.length).toBeGreaterThan(100);
    expect(ring.length).toBeLessThanOrEqual(900);
  });
});
