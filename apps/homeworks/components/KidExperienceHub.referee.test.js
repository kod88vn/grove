import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals'
import '@testing-library/jest-dom'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { listProblems } from '@grove/curriculum'
import { initDb, insertSession, getSessionItem } from '../lib/db.js'
import { gardenSummary } from '../lib/kidExperience.js'
import { KidExperienceHub } from './KidExperienceHub'
import { GET as getDaily } from '../app/api/daily/route.js'
import { POST as addItem } from '../app/api/sessions/[id]/items/route.js'

// U04 referee: each claim is visible in a response, stored session, or rendered child view.
// CLOSED run 268 spec d743ecdee81c5897fe760090e1b5acf3d435de41dff5484f9953734326b74fde
// archived verbatim in cc/tmp/loop-evidence/GROVE-G-KID-EXPERIENCE/run-268/.
// Superseded the five-attempt tree/fruiting and immediate boss assertions only:
// HOMEWORK_PLAN.md §6.5/§10 assigns ladder/Leitner and paths to U05. The adjacent
// KidExperienceHub.plan.test.js locks the corrected U04 plan and both sibling specs.
const priorResponse = global.Response
beforeEach(() => {
  initDb(':memory:')
  global.Response = class {
    static json(value, init = {}) { return { status: init.status ?? 200, json: async () => value } }
  }
  window.localStorage.clear()
})
afterEach(() => { global.Response = priorResponse; delete global.fetch; window.localStorage.clear() })

const grade = 5
const date = '2026-09-30'
async function dailyChallenge() {
  const result = await getDaily({ url: `http://localhost:3005/homeworks/api/daily?grade=${grade}&date=${date}` })
  expect(result.status).toBe(200)
  return result.json()
}

const profiles = [
  { id: 'kid-a', display_name: 'Mina', avatar: '🦊', grade: 5 },
  { id: 'kid-b', display_name: 'Theo', avatar: '🐻', grade: 4 },
]
const summary = (kid) => ({
  student: { id: kid.id, displayName: kid.display_name, avatar: kid.avatar, grade: kid.grade },
  rewards: { stars: 0, sunshine: 0 }, watering: { streak: 0, wateredDays: 0, weeklyGoalMet: false },
  badges: [], statuses: {}, suggestions: [{ id: 'm5.oa.order-of-operations', label: 'Order of Operations' }, { id: 'm5.nf.add-fractions-unlike', label: 'Fractions' }],
  garden: [{ skillId: 'm5.oa.order-of-operations', name: 'Order of Operations', stage: 'fruiting' }],
  problems: [{ id: 'm5.oa.order-of-operations/precedence', skill: 'm5.oa.order-of-operations', title: 'Boss: Order of Operations' }],
  continueSession: { sessionId: 'real-open-session', skillId: 'm5.oa.order-of-operations', problemId: 'm5.oa.order-of-operations/precedence' },
})

describe('U04 referee: canonical Daily Seed and completed game loop', () => {
  it('accepts only the ONE canonical problem for this grade/date, even when a different registered template shares its skill', async () => {
    const canonical = await dailyChallenge()
    const sameSkill = listProblems({ grade }).find((problem) => problem.skill === canonical.instance.skill && problem.id !== canonical.problemId)
    expect(sameSkill).toBeDefined() // exercise real catalog, not a fabricated problem
    insertSession({ id: 'daily-slot', student_id: 'public', kind: 'daily', skill_id: canonical.instance.skill, local_date: date, tz: 'UTC' })
    const invalid = await addItem({ json: async () => ({ problemId: sameSkill.id }) }, { params: Promise.resolve({ id: 'daily-slot' }) })
    expect(invalid.status).toBe(400)
    expect(getSessionItem('daily-slot', sameSkill.id, canonical.seed)).toBeNull()
    const valid = await addItem({ json: async () => ({ problemId: canonical.problemId }) }, { params: Promise.resolve({ id: 'daily-slot' }) })
    expect(valid.status).toBe(201)
    expect((await valid.json()).seed).toBe(canonical.seed)
  })

  it('does not allow kind=daily with no skill binding to bypass the canonical grade/date seed or problem', async () => {
    const canonical = await dailyChallenge()
    insertSession({ id: 'unbound-daily', student_id: 'public', kind: 'daily', skill_id: null, local_date: date, tz: 'UTC' })
    const result = await addItem({ json: async () => ({ problemId: canonical.problemId }) }, { params: Promise.resolve({ id: 'unbound-daily' }) })
    if (result.status === 201) expect((await result.json()).seed).toBe(canonical.seed)
    else expect(result.status).toBe(400) // rejecting malformed daily session is safe too
  })

  it('offers Continue for an actual open session and renders garden stages honestly', async () => {
    global.fetch = jest.fn(async (url) => {
      if (url === '/homeworks/api/students') return { ok: true, json: async () => ({ students: profiles }) }
      if (url.startsWith('/homeworks/api/kid-experience?')) return { ok: true, json: async () => summary(profiles[0]) }
      throw new Error(`Unexpected ${url}`)
    })
    const { unmount } = render(<KidExperienceHub mode="today" />)
    expect(await screen.findByRole('link', { name: /Continue/i })).toHaveAttribute('href', expect.stringContaining('real-open-session'))
    unmount()
    render(<KidExperienceHub mode="garden" />)
    expect(await screen.findByText('fruiting')).toBeInTheDocument()
  })

  it('never displays stale prior-child data or dispatches their grade while a new profile is loading', async () => {
    let resolveTheo
    global.fetch = jest.fn(async (url) => {
      if (url === '/homeworks/api/students') return { ok: true, json: async () => ({ students: profiles }) }
      if (url.startsWith('/homeworks/api/kid-experience?')) {
        const selected = new URL(url, 'http://localhost').searchParams.get('studentId')
        if (selected === 'kid-a') return { ok: true, json: async () => summary(profiles[0]) }
        return new Promise((resolve) => { resolveTheo = () => resolve({ ok: true, json: async () => summary(profiles[1]) }) })
      }
      throw new Error(`Unexpected ${url}`)
    })
    render(<KidExperienceHub mode="today" />)
    expect(await screen.findByText('Welcome, 🦊 Mina!')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText("Who's practicing?"), { target: { value: 'kid-b' } })
    expect(screen.queryByText('Welcome, 🦊 Mina!')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Daily Seed/ })).not.toBeInTheDocument()
    await waitFor(() => expect(resolveTheo).toEqual(expect.any(Function)))
    resolveTheo()
    expect(await screen.findByText('Welcome, 🐻 Theo!')).toBeInTheDocument()
  })
})
