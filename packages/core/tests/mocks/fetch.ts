import { afterEach, beforeEach, vi, type Mock } from 'vitest';

export type FetchMockOptions = {
  ok?: boolean;
  status?: number;
  statusText?: string;
  headers?: Record<string, string>;
};

/** Build a minimal Response-like object for provider unit tests. */
export function jsonFetchResponse<T>(body: T, options: FetchMockOptions = {}): Response {
  const ok = options.ok ?? true;
  return {
    ok,
    status: options.status ?? (ok ? 200 : 500),
    statusText: options.statusText ?? (ok ? 'OK' : 'Error'),
    headers: new Headers(options.headers ?? { 'content-type': 'application/json' }),
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  } as Response;
}

/** Assign a global fetch mock that always resolves JSON (legacy pattern in provider tests). */
export function mockGlobalFetchJson<T>(body: T, options?: FetchMockOptions): Mock {
  const mock = vi.fn().mockResolvedValue(jsonFetchResponse(body, options));
  global.fetch = mock;
  return mock;
}

/** Vitest stubGlobal fetch helper with automatic cleanup via beforeEach/afterEach. */
export function useFetchStub(): {
  fetchMock: Mock;
  mockJson: <T>(body: T, options?: FetchMockOptions) => void;
} {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  return {
    fetchMock,
    mockJson: <T>(body: T, options?: FetchMockOptions) => {
      fetchMock.mockResolvedValue(jsonFetchResponse(body, options));
    },
  };
}
