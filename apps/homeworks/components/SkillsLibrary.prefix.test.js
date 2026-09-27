import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'
import '@testing-library/jest-dom'
import { render, waitFor } from '@testing-library/react'
import { readdirSync, readFileSync } from 'fs'
import path from 'path'

import { SkillsLibrary } from './SkillsLibrary'

// F5: SkillsLibrary fetched the bare /api/nora-homework/library alias while MathExercise uses the
// canonical /chat/api/nora-homework/library. The bare path only works through the gateway's
// catch-all /api -> /chat/api rewrite, so browser fetches must name Nora's /chat prefix directly.
const LIBRARY = '/chat/api/nora-homework/library?'
const APP_ROOT = path.resolve(__dirname, '..')

function sourceFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return sourceFiles(full)
    return entry.name.endsWith('.js') && !entry.name.endsWith('.test.js') ? [full] : []
  })
}

function respond(url) {
  if (url.includes('view=catalog')) {
    return { categories: [{ key: 'multiplication', category: 'Multiplication', skills: [] }] }
  }
  if (url.includes('view=summary')) return { summary: [] }
  if (url.includes('view=stats')) return { stats: { totalProblems: 0, skillsAttempted: 0, averageScore: 0 } }
  return { items: [] }
}

describe('homeworks library fetch prefix (F5)', () => {
  beforeEach(() => {
    global.fetch = jest.fn(async (url) => ({ ok: true, json: async () => respond(String(url)) }))
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  it('SkillsLibrary calls the Nora library route through its /chat prefix', async () => {
    render(<SkillsLibrary studentId="default" />)

    await waitFor(() => {
      expect(global.fetch.mock.calls.map(([url]) => String(url)).some((url) => url.includes('skillCategory='))).toBe(true)
    })
    const urls = global.fetch.mock.calls.map(([url]) => String(url))

    expect(urls).toHaveLength(4)
    expect(urls.filter((url) => !url.startsWith(LIBRARY))).toEqual([])
  })

  it('no homeworks source fetches the bare /api/ alias', () => {
    const offenders = ['app', 'components', 'lib']
      .flatMap((dir) => sourceFiles(path.join(APP_ROOT, dir)))
      .flatMap((file) =>
        [...readFileSync(file, 'utf8').matchAll(/fetch\(\s*[`'"](\/api\/[^`'"?$]*)/g)].map(
          (match) => `${path.relative(APP_ROOT, file)} -> ${match[1]}`
        )
      )

    expect(offenders).toEqual([])
  })
})
