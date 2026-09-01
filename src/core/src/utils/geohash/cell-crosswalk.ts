import { geohashTruncate } from './hierarchy';
import { validateGeohash } from './validation';

export type GeohashMultiMap<T extends string = string> = Readonly<
  Record<string, readonly T[] | T[]>
>;

export type InvertGeohashMapOptions = {
  onDuplicate?: 'first' | 'last';
};

export function invertGeohashMap<T extends string>(
  geohashToValues: GeohashMultiMap<T>,
  options?: InvertGeohashMapOptions,
): Record<T, string> {
  const onDuplicate = options?.onDuplicate ?? 'first';
  const out = {} as Record<T, string>;

  for (const [hash, values] of Object.entries(geohashToValues)) {
    for (const value of values ?? []) {
      const key = value as T;
      if (onDuplicate === 'first' && out[key]) continue;
      out[key] = hash;
    }
  }

  return out;
}

export function rollupGeohashMap<T extends string>(
  geohashToValues: GeohashMultiMap<T>,
  parentPrecision: number,
): Record<string, T[]> {
  const byHash = new Map<string, Set<T>>();

  for (const [nativeHash, values] of Object.entries(geohashToValues)) {
    if (!validateGeohash(nativeHash)) continue;
    const parentHash = geohashTruncate(nativeHash, parentPrecision);
    let bucket = byHash.get(parentHash);
    if (!bucket) {
      bucket = new Set<T>();
      byHash.set(parentHash, bucket);
    }
    for (const value of values ?? []) {
      bucket.add(value);
    }
  }

  const out: Record<string, T[]> = {};
  for (const [hash, bucket] of byHash) {
    out[hash] = [...bucket].sort();
  }
  return out;
}

export function keyToParentGeohash(
  key: string,
  keyOnRow: unknown,
  keyToNativeGeohash: Record<string, string>,
  parentPrecision: number,
): string | null {
  const nativeHash =
    typeof keyOnRow === 'string' && keyOnRow.length > 0 ? keyOnRow : keyToNativeGeohash[key];
  if (!nativeHash || !validateGeohash(nativeHash)) return null;
  try {
    return geohashTruncate(nativeHash, parentPrecision);
  } catch {
    return null;
  }
}

export const rollupGeohashToZips = rollupGeohashMap;
