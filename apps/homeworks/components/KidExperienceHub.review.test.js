import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals'
import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import HomeworksPage from '../app/page.js'
import { GardenDecorations } from './GardenDecorations.js'
import { KidExperienceHub } from './KidExperienceHub.js'
import { KidSettingsProvider, useKidSettings } from './KidSettingsProvider.js'

const originalFetch = global.fetch
const originalMatchMedia = window.matchMedia
const response = (payload) => ({ ok: true, json: async () => payload })
const student = { id: 'review-kid', display_name: 'Review', avatar: '🦊', grade: 5 }
const summary = {
  student: { id: student.id, displayName: 'Review', avatar: '🦊', grade: 5 },
  rewards: { stars: 0, sunshine: 0 }, watering: { streak: 0, wateredDays: 0 },
  garden: [], badges: [], suggestions: [], problems: [], statuses: {}, continueSession: null,
}

beforeEach(() => {
  window.localStorage.clear()
  global.fetch = jest.fn(async (url) => {
    if (url === '/homeworks/api/students') return response({ students: [student] })
    if (url.startsWith('/homeworks/api/kid-experience?')) return response(summary)
    if (url.startsWith('/homeworks/api/problems?')) return response({ problems: [
      { id: 'm5.oa.order-of-operations/precedence', skill: 'm5.oa.order-of-operations', title: 'Order of Operations', difficulty: 1 },
    ] })
    throw new Error(`Unexpected request ${url}`)
  })
})
afterEach(() => { global.fetch = originalFetch; window.matchMedia = originalMatchMedia; window.localStorage.clear() })

describe('PR #108 observed review regressions', () => {
  it('exposes one main landmark when Today is embedded in Homeworks root alongside legacy content', async () => {
    render(<HomeworksPage />)
    await screen.findByRole('heading', { name: 'Today' })
    expect(screen.getAllByRole('main')).toHaveLength(1)
  })

  it('opens Daily Seed from the root through a basePath-aware navigation link', async () => {
    render(<HomeworksPage />)
    await screen.findByRole('heading', { name: 'Today' })
    expect(screen.getByRole('link', { name: '🌞 Daily Seed' })).toHaveAttribute('href', expect.stringMatching(/(?:\/homeworks)?\/today$/))
  })

  it('names each decoration purchase and owned button so the child knows which item it affects', () => {
    render(<GardenDecorations summary={{ rewards: { sunshine: 5 }, decorations: { owned: [{ id: 'lantern', name: 'Lantern' }], catalog: [
      { id: 'lantern', name: 'Lantern', price: 2 }, { id: 'bench', name: 'Bench', price: 4 },
    ] } }} busy={false} onBuy={() => {}} />)
    expect(screen.getByRole('button', { name: /Lantern owned/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /Buy Bench decoration/i })).toBeEnabled()
  })

  it('names the filtered quest start action with its specific title', async () => {
    render(<KidExperienceHub mode="quests" />)
    await screen.findByText('Order of Operations')
    expect(screen.getByRole('button', { name: /Start Order of Operations quest/i })).toBeEnabled()
  })

  it('keeps an enabled sound setting available under reduced-motion while disabling motion', async () => {
    window.matchMedia = jest.fn(() => ({ matches: true, addEventListener() {}, removeEventListener() {} }))
    function Probe() {
      const { soundsAllowed, motionAllowed } = useKidSettings()
      return <p>{`sound:${soundsAllowed},motion:${motionAllowed}`}</p>
    }
    render(<KidSettingsProvider><Probe /></KidSettingsProvider>)
    expect(await screen.findByText('sound:true,motion:false')).toBeInTheDocument()
  })

  it('leaves the unit and phase acceptance unchecked until PR #108 merges', () => {
    const progress = readFileSync(resolve(__dirname, '../../../HOMEWORK_PROGRESS.md'), 'utf8')
    expect(progress).toMatch(/\| \[ \] U04 G-KID-EXPERIENCE \|/)
    for (let step = 1; step <= 8; step++) expect(progress).toMatch(new RegExp(`- \\[ \\] P3\\.${step}\\b`))
  })
})
