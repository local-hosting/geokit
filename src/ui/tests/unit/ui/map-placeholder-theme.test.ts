import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import {
  createPlaceholderContent,
  MAP_PLACEHOLDER_STYLE,
} from '../../../src/components/elements/map/style/map-placeholder'

const uiSrc = join(dirname(fileURLToPath(import.meta.url)), '../../../src')
const connectedInit = readFileSync(
  join(uiSrc, 'components/elements/map/map-connected-init.ts'),
  'utf8',
)
const styleSetup = readFileSync(join(uiSrc, 'components/elements/map/map-style-setup.ts'), 'utf8')

describe('gk-map placeholder theme (no dark FOUC)', () => {
  it('inline placeholder fallbacks match theme.css light defaults', () => {
    expect(MAP_PLACEHOLDER_STYLE).toContain('--gk-placeholder-background, #f5f5f5')
    expect(MAP_PLACEHOLDER_STYLE).toContain('--gk-placeholder-text, #6b7280')
    expect(MAP_PLACEHOLDER_STYLE).not.toContain('#141414')
    expect(createPlaceholderContent('Loading map...', true)).toContain('#6b7280')
  })

  it('applies theme chrome before showing the loading placeholder', () => {
    const applyIdx = connectedInit.indexOf('applyThemeChromeBeforePaint')
    const placeholderIdx = connectedInit.indexOf('showPlaceholderIfNeeded')
    expect(applyIdx).toBeGreaterThan(-1)
    expect(placeholderIdx).toBeGreaterThan(applyIdx)
  })

  it('syncThemeClass always sets gk-theme-light or gk-theme-dark (browser when no theme attr)', () => {
    expect(styleSetup).toMatch(/applyThemeChromeBeforePaint/)
    expect(styleSetup).toMatch(/getSystemTheme\(\)/)
    expect(styleSetup).toMatch(/this\.classList\.add\('gk-theme-' \+ name\)/)
  })
})
