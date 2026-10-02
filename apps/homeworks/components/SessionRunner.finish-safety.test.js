import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals'
import '@testing-library/jest-dom'
import { fireEvent, render, screen } from '@testing-library/react'
import { getProblem, listProblems, render as renderProblem, toInstance } from '@grove/curriculum'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { getSessionById, initDb, insertAttempt, insertSession, insertSessionItem } from '../lib/db.js'
import { POST as finish } from '../app/api/sessions/[id]/finish/route.js'
import { POST as issueItem } from '../app/api/sessions/[id]/items/route.js'
import { POST as submitAttempt } from '../app/api/attempts/route.js'
import { SessionRunner } from './SessionRunner'

const oldResponse = global.Response
const skill = 'm5.oa.order-of-operations'
const problem = listProblems({ skill })[0]
const issued = renderProblem(getProblem(problem.id), 17)
const item = toInstance(issued)
const postFinish = () => finish({}, { params: Promise.resolve({ id: 'first' }) })
const add = (id, sessionId) => insertAttempt({
  id, session_id: sessionId, student_id: 'public', subject: 'math', grade: 5, skill_id: skill,
  problem_id: problem.id, content_version: 1, seed: 17, difficulty: 1,
  shown: {}, response: {}, answer: {}, correct: true, tries: 1, hints_used: 0,
  revealed: 0, stars: 3, rubric: null, duration_ms: 1, local_date: '2026-09-30',
})

beforeEach(() => {
  initDb(':memory:')
  insertSession({ id: 'first', student_id: 'public', kind: 'skill', skill_id: skill, local_date: '2026-09-30', tz: 'UTC' })
  global.Response = class {
    static json(value, init = {}) { return { ok: (init.status ?? 200) < 400, status: init.status ?? 200, json: async () => value } }
  }
})
afterEach(() => { global.Response = oldResponse; delete global.fetch })

describe('U04 session finish safety at the acceptance boundary', () => {
  it('preserves the byte-for-byte prior locked U04 assertions', () => {
    const digests = {
      'lib/kidExperience.test.js': 'eadb2608218134151cc310106315489e994346e51e26b5163d8b7c3a7efd0bf9',
      'components/KidExperienceHub.referee.test.js': '5635b10577f3efe27ea50f5a14e3975813d91e732a7ce5403ca81f0f6dfca3f7',
      'components/KidExperienceHub.plan.test.js': '20a5505a468e01201391d72ab0d5b7f2f28d5d7829884b7d2c2cb19366366f2f',
    }
    for (const [file, expected] of Object.entries(digests)) {
      expect(createHash('sha256').update(readFileSync(resolve(process.cwd(), file))).digest('hex')).toBe(expected)
    }
  })

  it('keeps the first server-earned result unchanged after later sessions on the same skill', async () => {
    add('first-earned', 'first')
    const first = await (await postFinish()).json()
    expect(first.grew).toEqual([{ skillId: skill, name: expect.any(String), from: 'seed', to: 'sprout' }])
    insertSession({ id: 'later', student_id: 'public', kind: 'skill', skill_id: skill, local_date: '2026-09-30', tz: 'UTC' })
    for (let i = 0; i < 9; i++) add(`later-${i}`, 'later')
    expect(await (await postFinish()).json()).toEqual(first)
    expect(getSessionById('first').finished_at).toBeGreaterThan(0)
  })

  it('refuses new bound items and scored attempts after a session was finished, leaving lifetime stars unchanged', async () => {
    insertSessionItem({ session_id: 'first', problem_id: problem.id, seed: 17 })
    await postFinish()
    const newlyIssued = await issueItem({ json: async () => ({ problemId: problem.id }) }, { params: Promise.resolve({ id: 'first' }) })
    expect(newlyIssued.status).toBe(409)
    const scored = await submitAttempt({ json: async () => ({ sessionId: 'first', problemId: problem.id, seed: 17, response: { text: '1' } }) })
    expect(scored.status).toBe(409)
  })

  it('never displays a saved session or invented zero stars when the finish POST fails; offers a retry', async () => {
    global.fetch = jest.fn(async (url) => {
      if (url === `/homeworks/api/problems?skill=${skill}`) return { ok: true, json: async () => ({ problems: [problem] }) }
      if (url === '/homeworks/api/sessions/first/items') return { ok: true, json: async () => ({ seed: 17, instance: item }) }
      if (url === '/homeworks/api/attempts') return { ok: true, json: async () => ({ correct: true, stars: 3, explanation: issued.explanation }) }
      if (url === '/homeworks/api/sessions/first/finish') return { ok: false, status: 503, json: async () => ({ error: 'Storage unavailable' }) }
      throw new Error(`Unexpected request ${url}`)
    })
    render(<SessionRunner sessionId="first" studentId="public" skill={skill} count={1} />)
    await screen.findByText(item.prompt)
    if (issued.widget === 'steps') {
      const fields = await screen.findAllByRole('textbox', { name: /step/i })
      fields.forEach((field, i) => fireEvent.change(field, { target: { value: issued.answer.steps[i].expression } }))
    } else {
      fireEvent.change(await screen.findByLabelText('Your answer'), { target: { value: String(issued.answer.value) } })
    }
    fireEvent.click(screen.getByRole('button', { name: /Check/ }))
    await screen.findByText('How Nora solved it')
    fireEvent.click(screen.getByRole('button', { name: /Finish/ }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Storage unavailable')
    expect(screen.queryByText('Great work!')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('0 stars earned')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Finish|Retry/i })).toBeEnabled()
  })
})
