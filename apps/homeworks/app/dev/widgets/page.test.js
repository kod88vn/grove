/**
 * P2.5 — the route: `/homeworks/dev/widgets`, and only in development.
 *
 * HOMEWORK_PLAN.md §10 Phase 2 acceptance: 'a "widget gallery" page at
 * `/homeworks/dev/widgets` (dev only) renders every widget with a sample problem'.
 *
 * Two separate claims live here, and they need separate proof:
 *
 *   1. In development the page really draws the gallery — every sample gets a card, and
 *      the Band C/D maths rendering picked in P2.4 is on show too.
 *   2. In production the route does not exist. The gallery reveals answers, so this is not
 *      cosmetic: a page that merely hides the link is still served. The guard must run on
 *      the server, before any markup is produced, which is why this file also asserts the
 *      page is NOT a client component — `'use client'` would ship the whole thing, guard
 *      and answers alike, to the browser.
 *
 * A jest assertion cannot prove that a real production server 404s; that is checked
 * separately with `next build && next start` and curl. What it CAN prove is that the code
 * path exists and is taken, which is the part that rots silently.
 */
import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, jest, test } from '@jest/globals'
import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'

import { GALLERY_SEED, MATH_SAMPLE, gallerySamples } from './samples'

class NotFoundSentinel extends Error {}

const mockNotFound = jest.fn(() => {
  throw new NotFoundSentinel('NEXT_NOT_FOUND')
})

jest.mock('next/navigation', () => ({ notFound: (...args) => mockNotFound(...args) }))

import Page from './page'

const source = fs.readFileSync(path.join(__dirname, 'page.js'), 'utf8')
const nextConfig = fs.readFileSync(
  path.join(__dirname, '..', '..', '..', 'next.config.js'),
  'utf8',
)
const samples = gallerySamples()

/** Run the page with NODE_ENV forced, then put it back however the call ends. */
function withNodeEnv(value, fn) {
  const before = process.env.NODE_ENV
  process.env.NODE_ENV = value
  try {
    return fn()
  } finally {
    process.env.NODE_ENV = before
  }
}

describe('the page lives at the address the plan names', () => {
  test('the app is mounted at /homeworks, so app/dev/widgets/page.js is /homeworks/dev/widgets', () => {
    expect(nextConfig).toContain("basePath: '/homeworks'")
    expect(fs.existsSync(path.join(__dirname, 'page.js'))).toBe(true)
  })

  test('it is a server component — the dev-only guard must not be shipped to the browser', () => {
    expect(source.startsWith("'use client'")).toBe(false)
    expect(source).not.toContain('use client')
  })
})

describe('in development it renders the gallery', () => {
  test('every sample gets a card', () => {
    mockNotFound.mockClear()
    withNodeEnv('development', () => render(<Page />))
    expect(mockNotFound).not.toHaveBeenCalled()
    expect(document.querySelectorAll('[data-widget]')).toHaveLength(samples.length)
    for (const sample of samples) {
      expect(document.querySelectorAll(`[data-widget="${sample.widget}"]`)).toHaveLength(1)
    }
  })

  test('each card is interactive — it offers to check an answer', () => {
    withNodeEnv('development', () => render(<Page />))
    expect(screen.getAllByRole('button', { name: /check/i })).toHaveLength(samples.length)
  })

  test('the maths rendering from P2.4 is on show, as real MathML', () => {
    const { container } = withNodeEnv('development', () => render(<Page />))
    const html = container.innerHTML
    expect(html).toContain('msup')
    expect(html).toContain('msqrt')
    expect(container.textContent).toContain('π')
    expect(screen.getByText(MATH_SAMPLE.caption)).toBeInTheDocument()
  })

  test('the reader is told the samples are fixed, by showing the seed they come from', () => {
    const { container } = withNodeEnv('development', () => render(<Page />))
    expect(container.textContent).toContain(String(GALLERY_SEED))
  })

  test('it says the page is dev only, in plain words, above the answers', () => {
    const { container } = withNodeEnv('development', () => render(<Page />))
    expect(container.textContent).toMatch(/dev only/i)
  })

  test('it speaks of Nora, never of "AI"', () => {
    const { container } = withNodeEnv('development', () => render(<Page />))
    expect(container.textContent).not.toMatch(/\bAI\b/)
  })
})

describe('in production the route does not exist', () => {
  test('the page calls notFound() instead of returning markup', () => {
    mockNotFound.mockClear()
    expect(() => withNodeEnv('production', () => Page())).toThrow(NotFoundSentinel)
    expect(mockNotFound).toHaveBeenCalledTimes(1)
  })

  test('it bails out before it builds any of the gallery', () => {
    mockNotFound.mockClear()
    let produced = null
    try {
      withNodeEnv('production', () => {
        produced = Page()
      })
    } catch (error) {
      expect(error).toBeInstanceOf(NotFoundSentinel)
    }
    expect(produced).toBeNull()
    expect(document.querySelectorAll('[data-widget]')).toHaveLength(0)
  })
})
