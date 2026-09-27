/**
 * Bug: "Review Submissions" on /homeworks goes to /homeworks/homeworks/review (404).
 *
 * next.config.js sets basePath '/homeworks', and next/link prepends it to every href.
 * An in-app <Link> href must therefore be basePath-relative. Verified at runtime on
 * 754ac58: the dev server rendered href="/homeworks/homeworks/review", which 404s.
 */
import { describe, it, expect, jest } from '@jest/globals'
import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import fs from 'node:fs'
import path from 'node:path'

jest.mock('../components/EnglishExercise.js', () => ({
  EnglishExercise: () => <div>EnglishExercise</div>,
}))

jest.mock('../components/MathExercise.js', () => ({
  MathExercise: () => <div>MathExercise</div>,
}))

import HomeworksPage from './page'

const APP_ROOT = path.resolve(__dirname, '..')
const APP_DIR = path.join(APP_ROOT, 'app')

function routeFileFor(href) {
  const pathname = href.split(/[?#]/)[0].replace(/\/$/, '')
  return path.join(APP_DIR, pathname, 'page.js')
}

function sourceFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return sourceFiles(full)
    return /\.jsx?$/.test(entry.name) && !/\.(test|spec)\.jsx?$/.test(entry.name) ? [full] : []
  })
}

describe('homeworks in-app links resolve under basePath', () => {
  it('Review Submissions points at the review route, relative to basePath', () => {
    render(<HomeworksPage />)

    const href = screen.getByRole('link', { name: /review submissions/i }).getAttribute('href')

    expect(href).toBe('/review')
    expect(fs.existsSync(routeFileFor(href))).toBe(true)
  })

  it('every <Link> on the home page resolves to an existing app route', () => {
    render(<HomeworksPage />)

    const unresolved = screen
      .getAllByRole('link')
      .map((link) => link.getAttribute('href'))
      .filter((href) => href.startsWith('/'))
      .filter((href) => !fs.existsSync(routeFileFor(href)))

    expect(unresolved).toEqual([])
  })

  it('no next/link href in the app hard-codes the /homeworks basePath', () => {
    const offenders = [...sourceFiles(APP_DIR), ...sourceFiles(path.join(APP_ROOT, 'components'))]
      .filter((file) => /from ['"]next\/link['"]/.test(fs.readFileSync(file, 'utf8')))
      .filter((file) => /<Link[^>]*href=\{?\s*['"`]\/homeworks(\/|['"`?#])/.test(fs.readFileSync(file, 'utf8')))
      .map((file) => path.relative(APP_ROOT, file))

    expect(offenders).toEqual([])
  })
})
