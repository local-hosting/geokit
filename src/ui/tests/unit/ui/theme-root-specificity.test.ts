import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const themeCss = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../../../src/theme.css'),
  'utf8',
)

describe('theme.css root defaults', () => {
  it('declares document defaults at zero specificity so app :root tokens win after a late inject', () => {
    expect(themeCss).not.toMatch(/(^|\n)\s*:root\s*\{/)
    expect(themeCss.match(/:where\(:root\)\s*\{/g)).toHaveLength(2)
  })
})
