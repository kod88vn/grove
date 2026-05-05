import { describe, expect, it } from '@jest/globals'
import { readFileSync } from 'fs'
import { resolve } from 'path'

describe('globals.css', () => {
  it('does not set display:flex on body (causes content to hug left)', () => {
    const css = readFileSync(resolve(__dirname, './globals.css'), 'utf8')
    expect(css).not.toMatch(/body\s*\{[^}]*display\s*:\s*flex/)
  })
})