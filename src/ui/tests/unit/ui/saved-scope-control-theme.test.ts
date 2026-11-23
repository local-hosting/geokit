import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const themeCss = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../../../src/theme.css'),
  'utf8',
)

describe('gk-ctrl-saved-scope theme', () => {
  it('uses #333 outline when off and filled hex when on (no orange)', () => {
    expect(themeCss).toMatch(
      /gk-ctrl-saved-scope \.maplibregl-ctrl-icon[\s\S]*?fill='none' stroke='%23333'/,
    )
    expect(themeCss).toMatch(
      /gk-ctrl-saved-scope-enabled \.maplibregl-ctrl-icon[\s\S]*?fill='%23d4d4d4' stroke='%23333'/,
    )
    expect(themeCss).not.toMatch(/gk-ctrl-saved-scope-enabled[\s\S]{0,400}%23fb923c/)
    expect(themeCss).not.toMatch(/gk-ctrl-saved-scope-enabled[\s\S]{0,400}%23ea580c/)
  })

  it('renders the glyph slightly smaller than terrain for visual balance', () => {
    expect(themeCss).toMatch(
      /gk-ctrl-saved-scope \.maplibregl-ctrl-icon[\s\S]*?background-size:\s*15px 15px/,
    )
  })
})