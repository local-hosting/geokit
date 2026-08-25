import { describe, expect, it } from 'vitest';
import {
  envTrim,
  firstEnv,
  readProcessEnv,
  readRuntimeEnv,
  readViteEnv,
  stripTrailingSlash,
  writeEnvKeys,
} from '../../src/primitives.js';

describe('env primitives', () => {
  it('trims env values and treats empty strings as undefined', () => {
    expect(envTrim({ FOO: '  bar  ' }, 'FOO')).toBe('bar');
    expect(envTrim({ FOO: '   ' }, 'FOO')).toBeUndefined();
    expect(envTrim({}, 'MISSING')).toBeUndefined();
  });

  it('returns the first non-empty env value from a key list', () => {
    expect(firstEnv({ A: '', B: 'value' }, ['A', 'B', 'C'])).toBe('value');
    expect(firstEnv({}, ['A', 'B'])).toBeUndefined();
  });

  it('strips trailing slashes from urls', () => {
    expect(stripTrailingSlash('https://example.com/')).toBe('https://example.com');
    expect(stripTrailingSlash('https://example.com')).toBe('https://example.com');
  });

  it('reads process env when available', () => {
    const env = readProcessEnv();
    expect(typeof env).toBe('object');
  });

  it('prefers process env in readRuntimeEnv', () => {
    const env = readRuntimeEnv();
    expect(env).toBeTruthy();
  });

  it('returns an object from readViteEnv in test runtime', () => {
    expect(typeof readViteEnv()).toBe('object');
  });

  it('writes values to multiple env keys', () => {
    const env: Record<string, string> = {};
    writeEnvKeys(env, ['A', 'B'], 'shared');
    expect(env).toEqual({ A: 'shared', B: 'shared' });
  });
});
