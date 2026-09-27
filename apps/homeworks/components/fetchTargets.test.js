/**
 * @jest-environment node
 */
import { describe, expect, it } from '@jest/globals'
import { existsSync, readdirSync, readFileSync } from 'fs'
import path from 'path'

// F4: ProgressReview fetched /homeworks/api/progress and ParentView fetched /api/parent.
// Neither route exists and nothing renders either component (git grep), so both are deleted.
const APP_ROOT = path.resolve(__dirname, '..')
const SOURCE_DIRS = ['app', 'components', 'lib']

function sourceFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return sourceFiles(full)
    return entry.name.endsWith('.js') && !entry.name.endsWith('.test.js') ? [full] : []
  })
}

const sources = SOURCE_DIRS.flatMap((dir) => sourceFiles(path.join(APP_ROOT, dir)))
  .map((file) => ({ file: path.relative(APP_ROOT, file), text: readFileSync(file, 'utf8') }))

describe('homeworks fetch targets (F4)', () => {
  it('removes the components that called routes which do not exist', () => {
    expect(existsSync(path.join(APP_ROOT, 'components/ParentView.js'))).toBe(false)
    expect(existsSync(path.join(APP_ROOT, 'components/ProgressReview.js'))).toBe(false)
  })

  it('leaves no source or README reference to the deleted components or routes', () => {
    const readme = { file: 'README.md', text: readFileSync(path.join(APP_ROOT, 'README.md'), 'utf8') }
    const stale = /ParentView|ProgressReview|\/api\/progress\b|\/api\/parent\b/
    const offenders = [...sources, readme].filter(({ text }) => stale.test(text)).map(({ file }) => file)

    expect(offenders).toEqual([])
  })

  it('only fetches /homeworks/api routes that have a route handler', () => {
    const missing = sources.flatMap(({ file, text }) =>
      [...text.matchAll(/\/homeworks\/api\/([a-z0-9-]+)/g)]
        .map((match) => match[1])
        .filter((name) => !existsSync(path.join(APP_ROOT, 'app/api', name, 'route.js')))
        .map((name) => `${file} -> /homeworks/api/${name}`)
    )

    expect(missing).toEqual([])
  })
})
