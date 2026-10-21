import { afterEach, describe, expect, it, jest } from '@jest/globals'
import '@testing-library/jest-dom'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'

import { KidExperienceHub } from './KidExperienceHub'

const skill = { id: 'm5.oa.order-of-operations', label: 'Order of Operations', name: 'Order of Operations' }
const baseSummary = {
  student: { id: 'kid-a', displayName: 'Mina', avatar: '🦊', grade: 5 },
  rewards: { stars: 3, sunshine: 3 },
  watering: { streak: 2, wateredDays: 2, weeklyGoalMet: false },
  badges: [{ id: 'first-solve', label: 'First Quest' }],
  garden: [
    { skillId: skill.id, name: skill.name, stage: 'sprout' },
    { skillId: 'm5.nf.add-fractions-unlike', name: 'Add Fractions', stage: 'seed' },
  ],
  suggestions: [skill, { id: 'm5.nf.add-fractions', label: 'Add Fractions', name: 'Add Fractions' }],
  problems: [{ id: 'm5.oa.order-of-operations/precedence', title: 'Order Operations', skill: skill.id }],
  statuses: { 'm5.oa.order-of-operations/precedence': 'untried' },
}

function installApi() {
  global.fetch = jest.fn(async (url) => {
    if (url === '/homeworks/api/students') return { ok: true, json: async () => ({ students: [
      { id: 'kid-a', display_name: 'Mina', avatar: '🦊', grade: 5 },
      { id: 'kid-b', display_name: 'Theo', avatar: '🐻', grade: 5 },
    ] }) }
    if (url.startsWith('/homeworks/api/kid-experience')) {
      const selected = new URL(url, 'http://localhost').searchParams.get('studentId')
      return { ok: true, json: async () => ({ ...baseSummary, student: { ...baseSummary.student, id: selected, displayName: selected === 'kid-a' ? 'Mina' : 'Theo' } }) }
    }
    if (url.startsWith('/homeworks/api/next')) {
      return { ok: true, json: async () => ({ next: null, reviews: [], paths: [], skillStates: [] }) }
    }
    if (url.startsWith('/homeworks/api/problems?grade=')) {
      const grade = new URL(url, 'http://localhost').searchParams.get('grade')
      return { ok: true, json: async () => ({ problems: grade === '5' ? baseSummary.problems : [] }) }
    }
    throw new Error(`Unexpected request: ${url}`)
  })
}

afterEach(() => {
  delete global.fetch
  window.localStorage.clear()
})

describe('kid experience screens', () => {
  it('renders the real profile picker, daily challenge, stars, and two suggested skills', async () => {
    installApi()
    render(<KidExperienceHub mode="today" />)
    expect(await screen.findByText('Welcome, 🦊 Mina!')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Daily Seed/ })).toBeInTheDocument()
    expect(screen.getByText(/3 Sunshine/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Order of Operations/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Add Fractions/ })).toBeInTheDocument()
    expect(screen.getByLabelText('Choose an avatar')).toBeInTheDocument()
  })

  it('continues the exact open item with its selected kid instead of creating another session', async () => {
    installApi()
    const fetchApi = global.fetch
    global.fetch = jest.fn(async (url, options) => {
      const response = await fetchApi(url, options)
      if (url.startsWith('/homeworks/api/kid-experience?')) {
        return { ...response, json: async () => ({ ...baseSummary, continueSession: {
          sessionId: 'open-session', skillId: skill.id, problemId: 'm5.oa.order-of-operations/precedence',
        } }) }
      }
      return response
    })
    render(<KidExperienceHub mode="today" />)
    const link = await screen.findByRole('link', { name: /Continue/i })
    expect(link.getAttribute('href')).toContain('/play/open-session?')
    expect(link.getAttribute('href')).toContain(`skill=${skill.id}`)
    expect(link.getAttribute('href')).toContain('problemId=m5.oa.order-of-operations%2Fprecedence')
    expect(link.getAttribute('href')).toContain('studentId=kid-a')
    expect(global.fetch.mock.calls.some(([url]) => url === '/homeworks/api/sessions')).toBe(false)
  })

  it('changes the visible child when the avatar profile is selected', async () => {
    installApi()
    render(<KidExperienceHub mode="today" />)
    await screen.findByText('Welcome, 🦊 Mina!')
    fireEvent.change(screen.getByLabelText("Who's practicing?"), { target: { value: 'kid-b' } })
    await waitFor(() => expect(screen.getByText('Welcome, 🦊 Theo!')).toBeInTheDocument())
  })

  it('keeps a late prior-child response from replacing the selected child or enabling actions while loading', async () => {
    let resolveMina
    let resolveTheo
    global.fetch = jest.fn((url) => {
      if (url === '/homeworks/api/students') return Promise.resolve({ ok: true, json: async () => ({ students: [
        { id: 'kid-a', display_name: 'Mina', avatar: '🦊', grade: 5 },
        { id: 'kid-b', display_name: 'Theo', avatar: '🐻', grade: 5 },
      ] }) })
      if (url.startsWith('/homeworks/api/kid-experience?')) {
        const selected = new URL(url, 'http://localhost').searchParams.get('studentId')
        return new Promise((resolve) => {
          if (selected === 'kid-a') resolveMina = () => resolve({ ok: true, json: async () => baseSummary })
          else resolveTheo = () => resolve({ ok: true, json: async () => ({ ...baseSummary, student: { ...baseSummary.student, id: 'kid-b', displayName: 'Theo', avatar: '🐻' } }) })
        })
      }
      throw new Error(`Unexpected request: ${url}`)
    })
    render(<KidExperienceHub mode="today" />)
    await waitFor(() => expect(resolveMina).toEqual(expect.any(Function)))
    fireEvent.change(screen.getByLabelText("Who's practicing?"), { target: { value: 'kid-b' } })
    expect(screen.queryByText('Welcome, 🦊 Mina!')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Daily Seed/ })).not.toBeInTheDocument()
    await waitFor(() => expect(resolveTheo).toEqual(expect.any(Function)))
    await act(async () => resolveTheo())
    expect(await screen.findByText('Welcome, 🐻 Theo!')).toBeInTheDocument()
    await act(async () => resolveMina())
    expect(screen.queryByText('Welcome, 🦊 Mina!')).not.toBeInTheDocument()
    expect(screen.getByText('Welcome, 🐻 Theo!')).toBeInTheDocument()
    expect(global.fetch.mock.calls.some(([url]) => url === '/homeworks/api/sessions')).toBe(false)
  })

  it('shows only matching quest status results on the Quest Board', async () => {
    installApi()
    render(<KidExperienceHub mode="quests" />)
    expect(await screen.findByText('Order Operations')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'solved' } })
    await waitFor(() => expect(screen.queryByText('Order Operations')).not.toBeInTheDocument())
    expect(screen.getByText('No quests match those filters.')).toBeInTheDocument()
  })

  it('applies the selected grade filter to registered quest results', async () => {
    installApi()
    render(<KidExperienceHub mode="quests" />)
    expect(await screen.findByText('Order Operations')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Filter by grade'), { target: { value: '4' } })
    await waitFor(() => expect(screen.queryByText('Order Operations')).not.toBeInTheDocument())
    expect(screen.getByText('No quests match those filters.')).toBeInTheDocument()
  })

  it('shows seed and sprout stages without inventing a mastered tree', async () => {
    installApi()
    render(<KidExperienceHub mode="garden" />)
    expect(await screen.findByRole('heading', { name: /Nora's garden guide/ })).toBeInTheDocument()
    expect(screen.getByText('sprout')).toBeInTheDocument()
    expect(screen.getByText('seed')).toBeInTheDocument()
    expect(screen.queryByText('Path to the boss 👑')).not.toBeInTheDocument()
    expect(screen.queryByText(/Boss quest:/)).not.toBeInTheDocument()
  })

  it('offers the mastery next, due reviews, and hides plain suggestions', async () => {
    installApi()
    const fetchApi = global.fetch
    global.fetch = jest.fn(async (url, options) => {
      const response = await fetchApi(url, options)
      if (url.startsWith('/homeworks/api/next')) {
        return { ok: true, json: async () => ({
          next: { kind: 'review', skillId: skill.id, problemId: baseSummary.problems[0].id, title: 'Order Operations', reason: 'review-due' },
          reviews: [
            { skillId: skill.id, problemId: baseSummary.problems[0].id, title: 'Order Operations', dueDate: '2026-07-18' },
            { skillId: 'm5.nf.add-fractions-unlike', problemId: 'm5.nf.add-fractions-unlike/like', title: 'Add Fractions', dueDate: '2026-07-19' },
          ],
          paths: [],
          skillStates: [{ skillId: skill.id, stage: 'sapling', level: 2, box: 1, dueDate: '2026-07-18', attempts: 4, correct: 3 }],
        }) }
      }
      return response
    })
    render(<KidExperienceHub mode="today" />)
    expect(await screen.findByText("What's next")).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Play “Order Operations”/ })).toBeInTheDocument()
    expect(screen.getByText('🔁 Add Fractions')).toBeInTheDocument()
    expect(screen.queryByText('Try next')).not.toBeInTheDocument()
  })

  it('shows study paths with per-skill stages, locked skills, and a boss on the quest board', async () => {
    installApi()
    const fetchApi = global.fetch
    global.fetch = jest.fn(async (url) => {
      const response = await fetchApi(url)
      if (url.startsWith('/homeworks/api/next')) {
        return { ok: true, json: async () => ({
          next: null,
          reviews: [],
          // The shape the route returns after U05: describePath-annotated chains.
          paths: [{
            id: 'm5.fractions', name: 'Fractions', icon: '🍕', subject: 'math',
            terminal: 'm5.nf.add-fractions-unlike', bossProblemId: 'm5.nf.add-fractions-unlike/boss',
            bossReady: true, nextSkillId: null,
            skills: [
              { skillId: skill.id, stage: 'tree', locked: false, lockedBy: [] },
              { skillId: 'm5.nf.add-fractions-unlike', stage: 'seed', locked: true, lockedBy: [skill.id] },
            ],
          }],
          skillStates: [{ skillId: skill.id, stage: 'tree', level: 3, box: 2, dueDate: '2026-07-20', attempts: 6, correct: 6 }],
        }) }
      }
      return response
    })
    render(<KidExperienceHub mode="quests" />)
    expect(await screen.findByText(/Fractions/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Practice Order of Operations' })).toHaveTextContent('🌳')
    const locked = screen.getByRole('button', { name: 'Locked: grow Order of Operations first' })
    expect(locked).toHaveTextContent('🌰')
    expect(locked).toHaveTextContent('🔒')
    expect(screen.getByRole('button', { name: 'Play the Fractions boss' })).toHaveTextContent('Boss')
    fireEvent.click(locked)
    expect(await screen.findByText(/Grow "Order of Operations" first/)).toBeInTheDocument()
    expect(global.fetch.mock.calls.some(([url]) => url === '/homeworks/api/sessions')).toBe(false)
  })
})