import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const uiSrc = join(dirname(fileURLToPath(import.meta.url)), '../../../src')
const providerSource = readFileSync(join(uiSrc, 'providers/maptiler-provider.ts'), 'utf8')
const navSource = readFileSync(
  join(uiSrc, 'components/elements/map/map-public-nav.ts'),
  'utf8',
)

describe('MapTiler theme style resolution (light/dark toggle)', () => {
  it('provider exposes resolveStyleForTheme that proxies+inlines StyleSpec', () => {
    expect(providerSource).toMatch(/async resolveStyleForTheme\(/)
    expect(providerSource).toMatch(/getProxiedStyleObject\(/)
  })

  it('updateMapStyle prefers resolveStyleForTheme over raw getStyleForTheme URL', () => {
    expect(navSource).toMatch(/resolveStyleForTheme/)
    expect(navSource).toMatch(/_updateMapStyleAsync/)
  })

  it('theme setStyle preserves custom overlays instead of wiping venues', () => {
    expect(navSource).toMatch(/mapStyleSwapOptions/)
    expect(navSource).toMatch(/setStyle\([^)]*mapStyleSwapOptions\(\)/)
  })
})
