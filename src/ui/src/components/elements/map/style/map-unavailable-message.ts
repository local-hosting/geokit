/**
 * User-facing map failure copy (plain language) plus tech detail for logs.
 */

export type MapUnavailableKind =
  | 'missing-provider'
  | 'style-timeout'
  | 'webgl'
  | 'generic'

export function classifyMapInitFailure(
  message: string,
): Exclude<MapUnavailableKind, 'style-timeout'> {
  if (/losecontext|context already lost|invalid_operation|webgl/i.test(message)) {
    return 'webgl'
  }
  if (message.includes('No UI provider') || message.includes('api-key')) {
    return 'missing-provider'
  }
  return 'generic'
}

/** Placeholder text shown to end users — no vendor / WebGL / env jargon. */
export function mapUnavailableMessage(kind: MapUnavailableKind): string {
  switch (kind) {
    case 'missing-provider':
      return "Map isn't set up yet. Ask your admin to finish map setup."
    case 'style-timeout':
      return "Map didn't finish loading. Refresh the page and try again."
    case 'webgl':
      return 'Too many maps are open. Close some, then try again.'
    case 'generic':
      return "Map couldn't load. Refresh the page and try again."
    default: {
      const _exhaustive: never = kind
      return _exhaustive
    }
  }
}

/** Developer-facing detail for console / debug logs. */
export function mapUnavailableLogDetail(kind: MapUnavailableKind, detail?: string): string {
  const base = (() => {
    switch (kind) {
      case 'missing-provider':
        return 'No UI provider or api-key (set MAPTILER_KEY / provider on gk-map)'
      case 'style-timeout':
        return 'Style never loaded after 5s (check MapTiler key, network, or WebGL limits)'
      case 'webgl':
        return 'WebGL context unavailable (budget / too many maps)'
      case 'generic':
        return 'Map initialization failed'
      default: {
        const _exhaustive: never = kind
        return _exhaustive
      }
    }
  })()
  return detail ? `${base}: ${detail}` : base
}
