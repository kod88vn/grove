import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals'
import '@testing-library/jest-dom'
import { fireEvent, render, screen } from '@testing-library/react'
import { getProblem, listProblems, render as renderProblem, toInstance } from '@grove/curriculum'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { initDb, insertAttempt, insertSession, insertSessionItem, insertStudent, markSessionItemDone } from '../lib/db.js'
import { gardenSummary } from '../lib/kidExperience.js'
import { GET as kidSummary } from '../app/api/kid-experience/route.js'
import { POST as finishSession } from '../app/api/sessions/[id]/finish/route.js'
import { KidExperienceHub } from './KidExperienceHub'
import { SessionRunner } from './SessionRunner'
import HomeworksPage from '../app/page.js'

// Run 268's erroneous boss/5-attempt stage demands were archived by SHA256 and openly
// superseded after that run CLOSED. This new locked spec protects both surviving specs.
const siblingDigests = {
  'lib/kidExperience.test.js': 'eadb2608218134151cc310106315489e994346e51e26b5163d8b7c3a7efd0bf9',
  'components/KidExperienceHub.referee.test.js': '5635b10577f3efe27ea50f5a14e3975813d91e732a7ce5403ca81f0f6dfca3f7',
}
const oldResponse = global.Response
function response(value, status = 200) { return { ok: status >= 200 && status < 300, status, json: async () => value } }
const query = (id = 'kid-a') => kidSummary({ url: `http://localhost:3005/homeworks/api/kid-experience?studentId=${id}&date=2026-09-30` })
function addAttempt({ id, studentId = 'kid-a', sessionId = null, skill = 'm5.oa.order-of-operations', stars = 3, day = '2026-09-30' }) {
  insertAttempt({
    id, session_id: sessionId, student_id: studentId, subject: 'math', grade: 5,
    skill_id: skill, problem_id: 'm5.oa.order-of-operations/precedence',
    content_version: 1, seed: 17, difficulty: 1,
    shown: { prompt: 'example' }, response: { text: '12' }, answer: { text: '12' },
    correct: stars > 0, tries: 1, hints_used: 0, revealed: 0, stars,
    rubric: null, duration_ms: 123, local_date: day,
  })
}

beforeEach(() => {
  initDb(':memory:')
  insertStudent({ id: 'kid-a', display_name: 'Mina', avatar: '🦊', grade: 5, settings: {} })
  insertStudent({ id: 'kid-b', display_name: 'Theo', avatar: '🐻', grade: 5, settings: {} })
  global.Response = class {
    static json(value, init = {}) { return { status: init.status ?? 200, json: async () => value } }
  }
  window.localStorage.clear()
})
afterEach(() => { global.Response = oldResponse; delete global.fetch; window.localStorage.clear() })

describe('U04 plan-grounded kid experience (post-268 referee)', () => {
  it('locks the two preceding accepted spec bytes despite the audited supersession', () => {
    for (const [file, expected] of Object.entries(siblingDigests)) {
      const bytes = readFileSync(resolve(process.cwd(), file))
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(expected)
    }
  })

  it('opens Homeworks with the profile picker and Today action while preserving legacy Grade 5 tabs', async () => {
    global.fetch = jest.fn(async (url) => {
      if (url === '/homeworks/api/students') return response({ students: [{ id: 'kid-a', display_name: 'Mina', avatar: '🦊', grade: 5 }] })
      if (url.startsWith('/homeworks/api/kid-experience?')) return response({
        student: { id: 'kid-a', displayName: 'Mina', avatar: '🦊', grade: 5 },
        rewards: { stars: 0, sunshine: 0 }, watering: { streak: 0, wateredDays: 0 },
        badges: [], garden: [], suggestions: [], problems: [], statuses: {}, continueSession: null,
      })
      throw new Error(`Unexpected request ${url}`)
    })
    render(<HomeworksPage />)
    expect(await screen.findByLabelText("Who's practicing?")).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Daily Seed/i })).toBeInTheDocument()
    expect(screen.getByText('📚 English')).toBeInTheDocument()
    expect(screen.getByText('🔢 Math')).toBeInTheDocument()
  })

  it('spends only earned Sunshine on cosmetics; stars stay earned, owned items persist, and siblings do not share balances', async () => {
    const { POST: buy } = require('../app/api/decorations/route.js')
    const initial = await (await query()).json()
    expect(initial.decorations.catalog.length).toBeGreaterThanOrEqual(3)
    const product = initial.decorations.catalog[0]
    expect(product.price).toBeGreaterThan(0)
    for (let i = 0; i < Math.ceil(product.price / 3); i++) addAttempt({ id: `earned-${i}` })
    const before = (await (await query()).json()).rewards
    const bought = await buy({ json: async () => ({ studentId: 'kid-a', decorationId: product.id }) })
    expect(bought.status).toBe(201)
    const after = await (await query()).json()
    expect(after.rewards.stars).toBe(before.stars)
    expect(after.rewards.sunshine).toBe(before.sunshine - product.price)
    expect(after.decorations.owned.map(({ id }) => id)).toContain(product.id)
    expect((await (await query('kid-b')).json()).rewards.sunshine).toBe(0)
    expect((await buy({ json: async () => ({ studentId: 'kid-b', decorationId: product.id }) })).status).toBe(409)
    expect((await buy({ json: async () => ({ studentId: 'missing', decorationId: product.id }) })).status).toBe(404)
    expect((await buy({ json: async () => ({ studentId: 'kid-a', decorationId: 'not-real' }) })).status).toBe(404)
    expect((await buy({ json: async () => ({ studentId: 'kid-a', decorationId: product.id, stars: 1000 }) })).status).toBe(400)
  })

  it('uses the plan 10-attempt window: 9 stays sprout, 10 at 60% becomes sapling, 10 at 50% stays sprout; no fabricated mastery', () => {
    const skillId = 'm5.oa.order-of-operations'
    const skills = [{ id: skillId, name: 'Order of Operations' }]
    const row = (i, correct) => ({ student_id: 'kid-a', skill_id: skillId, local_date: `2026-09-${String(i + 1).padStart(2, '0')}`, correct: Number(correct), revealed: 0, stars: correct ? 3 : 0 })
    const sixOfNine = Array.from({ length: 9 }, (_, i) => row(i, i < 6))
    const sixOfTen = [...sixOfNine, row(9, false)]
    const fiveOfTen = Array.from({ length: 10 }, (_, i) => row(i, i < 5))
    const stage = (attempts) => gardenSummary({ skills, attempts, studentId: 'kid-a' })[0].stage
    expect(stage(sixOfNine)).toBe('sprout')
    expect(stage(sixOfTen)).toBe('sapling')
    expect(stage(fiveOfTen)).toBe('sprout')
    expect(stage(Array.from({ length: 11 }, (_, i) => row(i, true)))).toBe('sapling')
  })

  it('finishes from real per-session attempts: server stars, only skills grown in this session, idempotent result, empty session awards nothing', async () => {
    insertSession({ id: 'session-with-attempt', student_id: 'kid-a', kind: 'skill', skill_id: 'm5.oa.order-of-operations', local_date: '2026-09-30', tz: 'UTC' })
    insertSessionItem({ session_id: 'session-with-attempt', problem_id: 'm5.oa.order-of-operations/precedence', seed: 17 })
    markSessionItemDone('session-with-attempt', 'm5.oa.order-of-operations/precedence', 17)
    addAttempt({ id: 'previous-day', day: '2026-09-29', skill: 'm5.nf.add-fractions-unlike' })
    addAttempt({ id: 'this-session', sessionId: 'session-with-attempt', stars: 2 })
    const call = (id) => finishSession({}, { params: Promise.resolve({ id }) })
    const first = await (await call('session-with-attempt')).json()
    expect(first.stars).toBe(2)
    expect(first.grew.map(({ skillId }) => skillId)).toContain('m5.oa.order-of-operations')
    expect(first.grew.map(({ skillId }) => skillId)).not.toContain('m5.nf.add-fractions-unlike')
    expect(first.next).toBeTruthy()
    expect(await (await call('session-with-attempt')).json()).toEqual(first)
    insertSession({ id: 'empty', student_id: 'kid-a', kind: 'skill', skill_id: 'm5.oa.order-of-operations', local_date: '2026-09-30', tz: 'UTC' })
    const empty = await (await call('empty')).json()
    expect(empty.stars).toBe(0)
    expect(empty.grew).toEqual([])
  })

  it('renders server-earned stars and only this session\'s growth on the end card, not optimistic client totals or older sprouts', async () => {
    const skill = 'm5.oa.order-of-operations'
    const problem = listProblems({ skill })[0]
    const rendered = renderProblem(getProblem(problem.id), 17)
    const instance = toInstance(rendered)
    global.fetch = jest.fn(async (url) => {
      if (url === `/homeworks/api/problems?skill=${skill}`) return response({ problems: [problem] })
      if (url === '/homeworks/api/sessions/session-end/items') return response({ seed: 17, instance })
      if (url === '/homeworks/api/attempts') return response({ correct: true, stars: 3, feedback: 'Great work!', explanation: rendered.explanation })
      if (url === '/homeworks/api/sessions/session-end/finish') return response({ finished: true, stars: 1, grew: [
        { skillId: skill, name: 'Order of Operations', from: 'seed', to: 'sprout' },
      ], next: { id: 'm5.nf.add-fractions-unlike', label: 'Add Fractions' } })
      if (url.startsWith('/homeworks/api/kid-experience?')) return response({ rewards: { stars: 30, sunshine: 30 }, garden: [
        { skillId: skill, name: 'Order of Operations', stage: 'sprout' },
        { skillId: 'm5.nf.add-fractions-unlike', name: 'Add Fractions', stage: 'sprout' },
      ], suggestions: [{ id: 'm5.nf.add-fractions-unlike', label: 'Add Fractions' }] })
      throw new Error(`Unexpected ${url}`)
    })
    render(<SessionRunner sessionId="session-end" studentId="kid-a" skill={skill} count={1} />)
    await screen.findByText(instance.prompt)
    if (rendered.widget === 'steps') {
      const fields = await screen.findAllByRole('textbox', { name: /step/i })
      fields.forEach((field, index) => fireEvent.change(field, { target: { value: rendered.answer.steps[index].expression } }))
    } else {
      fireEvent.change(await screen.findByLabelText('Your answer'), { target: { value: String(rendered.answer.value) } })
    }
    fireEvent.click(screen.getByRole('button', { name: /Check/ }))
    await screen.findByText('How Nora solved it')
    fireEvent.click(screen.getByRole('button', { name: /Finish/ }))
    expect(await screen.findByLabelText('1 stars earned')).toBeInTheDocument()
    expect(screen.getByText(/Order of Operations/)).toBeInTheDocument()
    expect(screen.queryByText('🌱 Add Fractions')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Add Fractions/ })).toBeInTheDocument()
  })

  it('shows buy controls for at least three garden decorations and renders an already owned cosmetic', async () => {
    global.fetch = jest.fn(async (url) => {
      if (url === '/homeworks/api/students') return response({ students: [{ id: 'kid-a', display_name: 'Mina', avatar: '🦊', grade: 5 }] })
      if (url.startsWith('/homeworks/api/kid-experience?')) return response({
        student: { id: 'kid-a', displayName: 'Mina', avatar: '🦊', grade: 5 },
        rewards: { stars: 9, sunshine: 6 }, watering: { streak: 1, wateredDays: 1 },
        badges: [], garden: [], suggestions: [], problems: [], statuses: {},
        decorations: { catalog: [{ id: 'lantern', name: 'Lantern', price: 3 }, { id: 'bench', name: 'Bench', price: 4 }, { id: 'pond', name: 'Pond', price: 6 }], owned: [{ id: 'lantern', name: 'Lantern' }] },
      })
      throw new Error(`Unexpected ${url}`)
    })
    render(<KidExperienceHub mode="garden" />)
    expect(await screen.findByText(/Your Lantern/i)).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /Buy/i }).length).toBeGreaterThanOrEqual(2)
  })

  it('does not invent an instant boss/path; U05 owns prerequisite paths and ladder mastery', async () => {
    global.fetch = jest.fn(async (url) => {
      if (url === '/homeworks/api/students') return response({ students: [{ id: 'kid-a', display_name: 'Mina', avatar: '🦊', grade: 5 }] })
      if (url.startsWith('/homeworks/api/kid-experience?')) return response({
        student: { id: 'kid-a', displayName: 'Mina', avatar: '🦊', grade: 5 },
        rewards: { stars: 0, sunshine: 0 }, watering: { streak: 0, wateredDays: 0 },
        badges: [], garden: [], suggestions: [{ id: 'm5.oa.order-of-operations', name: 'Order of Operations' }],
        problems: [{ id: 'm5.oa.order-of-operations/precedence', skill: 'm5.oa.order-of-operations', title: 'Practice' }], statuses: {},
      })
      throw new Error(`Unexpected request ${url}`)
    })
    render(<KidExperienceHub mode="garden" />)
    await screen.findByRole('heading', { name: /Nora's garden guide/i })
    expect(screen.queryByText(/Path to the boss/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Boss quest/i })).not.toBeInTheDocument()
  })

  it('shows a friendly unavailable message for an unregistered grade, without creating any session', async () => {
    global.fetch = jest.fn(async (url, options) => {
      if (url === '/homeworks/api/students') return response({ students: [{ id: 'kid-a', display_name: 'Mina', avatar: '🦊', grade: 4 }] })
      if (url.startsWith('/homeworks/api/kid-experience?')) return response({
        student: { id: 'kid-a', displayName: 'Mina', avatar: '🦊', grade: 4 },
        rewards: { stars: 0, sunshine: 0 }, watering: { streak: 0, wateredDays: 0 },
        badges: [], garden: [], suggestions: [], problems: [], statuses: {}, continueSession: null,
      })
      if (url.startsWith('/homeworks/api/daily?')) return response({ error: 'No registered problems for this grade' }, 404)
      if (url === '/homeworks/api/sessions' && options?.method === 'POST') throw new Error('unregistered session must not be created')
      throw new Error(`Unexpected request ${url}`)
    })
    render(<KidExperienceHub mode="today" />)
    expect(await screen.findByText(/No Daily Seed for Grade 4 yet/i)).toBeInTheDocument()
    expect(global.fetch).not.toHaveBeenCalledWith('/homeworks/api/sessions', expect.objectContaining({ method: 'POST' }))
  })
})
