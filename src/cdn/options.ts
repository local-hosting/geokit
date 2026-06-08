import type { GlobeCdnFetchOptions } from './fetch';

export type CreateGlobeCdnOptionsInput = {
  baseUrl?: string;
  init?: RequestInit;
};

export function createGlobeCdnOptions(input?: CreateGlobeCdnOptionsInput): GlobeCdnFetchOptions {
  return {
    baseUrl: input?.baseUrl,
    init: input?.init,
  };
}
