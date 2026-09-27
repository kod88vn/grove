/**
 * Bug: when /homeworks/api/grade fails, EnglishExercise stores the error body as the
 * graded result and shows "Exercise Graded!" with "Score: undefined/undefined". It also
 * saves a 0/1 entry to reading history and calls onSubmit, and the child's answers are
 * gone because the form is replaced by the result screen.
 *
 * The grade route returns `{ error }` with a 4xx/5xx status on failure
 * (app/api/grade/route.js), so a failed grade is an ordinary, reachable response.
 * An upstream proxy can also answer with a non-JSON body (e.g. an HTML 502 page).
 */
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'
import '@testing-library/jest-dom'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

import { EnglishExercise } from './EnglishExercise'

const ok = (body) => ({ ok: true, status: 200, json: async () => body })

const gradeJsonFailure = {
  ok: false,
  status: 502,
  statusText: 'Bad Gateway',
  json: async () => ({ error: 'Nora is unavailable right now' }),
}

const gradeHtmlFailure = {
  ok: false,
  status: 502,
  statusText: 'Bad Gateway',
  json: async () => { throw new SyntaxError('Unexpected token < in JSON at position 0') },
  text: async () => '<html><body>Bad Gateway</body></html>',
}

const gradeSuccess = ok({
  gradeResult: { answers: [{ id: 1, score: 1, feedback: 'Correct' }] },
  score: 1, maxScore: 1, percentage: 100, feedback: 'Nice reading',
})

let gradeQueue

function isHistoryPost(url, opts) {
  return String(url).startsWith('/homeworks/api/reading-history') && opts?.method === 'POST'
}

function installFetch() {
  global.fetch = jest.fn(async (url, opts) => {
    const u = String(url)
    if (u.startsWith('/chat/api/nora-homework/topics')) return ok({ topics: [], categories: [] })
    if (isHistoryPost(u, opts)) return ok({ id: 'rh-1' })
    if (u.startsWith('/homeworks/api/reading-history')) return ok({ history: [] })
    if (u.startsWith('/homeworks/api/exercises')) {
      return ok({
        exercise: {
          passage: 'The quick fox ran home.',
          questions: [{ id: 1, type: 'short-answer', question: 'Who ran home?' }],
        },
        lessonKeyPoint: 'Finding the main character',
      })
    }
    if (u.startsWith('/homeworks/api/grade')) {
      const next = gradeQueue.shift()
      if (!next) throw new Error('unexpected extra grade request')
      if (next instanceof Error) throw next
      return next
    }
    throw new Error(`unexpected fetch ${u}`)
  })
}

function gradeCalls() {
  return global.fetch.mock.calls.filter(([url]) => String(url).startsWith('/homeworks/api/grade'))
}

function historyPosts() {
  return global.fetch.mock.calls.filter(([url, opts]) => isHistoryPost(url, opts))
}

async function loadAndAnswer() {
  fireEvent.click(screen.getByRole('button', { name: '✏️ New Exercise' }))
  await screen.findByText('Choose a Reading Topic')
  fireEvent.click(screen.getByText('🎲 Random (Surprise me!)'))
  await screen.findByText('The quick fox ran home.')
  fireEvent.change(screen.getByPlaceholderText('Type your answer here...'), {
    target: { value: 'The fox' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Submit Answers' }))
}

function expectFormKept() {
  expect(screen.queryByText('Exercise Graded!')).not.toBeInTheDocument()
  expect(screen.queryByText(/undefined/)).not.toBeInTheDocument()
  expect(screen.getByText('The quick fox ran home.')).toBeInTheDocument()
  expect(screen.getByPlaceholderText('Type your answer here...')).toHaveValue('The fox')
  expect(screen.getByRole('button', { name: 'Submit Answers' })).toBeEnabled()
}

describe('EnglishExercise when grading fails', () => {
  beforeEach(() => {
    gradeQueue = []
    installFetch()
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  it('shows the grading error and keeps the child\'s answers on an HTTP error', async () => {
    gradeQueue.push(gradeJsonFailure)
    const onSubmit = jest.fn()

    render(<EnglishExercise onSubmit={onSubmit} />)
    await loadAndAnswer()

    expect(await screen.findByRole('alert')).toHaveTextContent('Nora is unavailable right now')
    expectFormKept()
    expect(onSubmit).not.toHaveBeenCalled()
    expect(historyPosts()).toHaveLength(0)
    expect(screen.getByRole('button', { name: '📚 History (0)' })).toBeInTheDocument()
  })

  it('shows an error and keeps the answers when the grade request cannot be sent', async () => {
    gradeQueue.push(new TypeError('Failed to fetch'))
    const onSubmit = jest.fn()

    render(<EnglishExercise onSubmit={onSubmit} />)
    await loadAndAnswer()

    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expectFormKept()
    expect(onSubmit).not.toHaveBeenCalled()
    expect(historyPosts()).toHaveLength(0)
  })

  it('reports the HTTP status, not a JSON parse error, when the error body is not JSON', async () => {
    gradeQueue.push(gradeHtmlFailure)
    const onSubmit = jest.fn()

    render(<EnglishExercise onSubmit={onSubmit} />)
    await loadAndAnswer()

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('502')
    expect(alert).not.toHaveTextContent(/JSON|Unexpected token/)
    expectFormKept()
    expect(onSubmit).not.toHaveBeenCalled()
    expect(historyPosts()).toHaveLength(0)
  })

  it('lets the child resubmit the same answers after a failure, and clears the error', async () => {
    gradeQueue.push(gradeJsonFailure, gradeSuccess)
    const onSubmit = jest.fn()

    render(<EnglishExercise onSubmit={onSubmit} />)
    await loadAndAnswer()
    await screen.findByRole('alert')

    fireEvent.click(screen.getByRole('button', { name: 'Submit Answers' }))

    expect(await screen.findByText('Exercise Graded!')).toBeInTheDocument()
    expect(screen.getByText('Score: 1/1 (100%)')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    const calls = gradeCalls()
    expect(calls).toHaveLength(2)
    expect(JSON.parse(calls[1][1].body).answers).toEqual({ 1: 'The fox' })
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
    expect(historyPosts()).toHaveLength(1)
    expect(screen.getByRole('button', { name: '📚 History (1)' })).toBeInTheDocument()
  })
})
