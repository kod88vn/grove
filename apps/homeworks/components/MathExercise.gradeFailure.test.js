/**
 * Bug: when /homeworks/api/grade fails, MathExercise stores the error body as the
 * graded result, then renders `submitted.gradeResult.totalCorrect` and crashes.
 * The child's answers are lost with it.
 *
 * The grade route returns `{ error }` with a 4xx/5xx status on failure
 * (app/api/grade/route.js), so a failed grade is an ordinary, reachable response.
 */
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'
import '@testing-library/jest-dom'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

import { MathExercise } from './MathExercise'

const exerciseResponse = {
  ok: true,
  status: 200,
  json: async () => ({
    exercise: {
      problems: [{
        id: 1,
        problem: '2 + 4',
        operations: ['addition'],
        skillCategory: 'addition-subtraction',
        skillName: 'Add Whole Numbers',
        skillLabel: '➕ Add Whole Numbers',
      }],
    },
  }),
}

const gradeFailure = {
  ok: false,
  status: 502,
  statusText: 'Bad Gateway',
  json: async () => ({ error: 'Nora is unavailable right now' }),
}

const gradeSuccess = {
  ok: true,
  status: 200,
  json: async () => ({
    gradeResult: {
      totalCorrect: 1,
      totalProblems: 1,
      comment: 'Nice work',
      problems: [{ id: 1, correct: true, workShown: true, feedback: 'Correct' }],
    },
    score: 1, maxScore: 1, percentage: 100, feedback: 'Nice work',
  }),
}

const librarySave = { ok: true, status: 200, json: async () => ({ id: 'lib-1', success: true }) }

async function loadAndAnswer() {
  fireEvent.click(screen.getByRole('button', { name: 'Start Math Problems' }))
  await screen.findByText('Problem 1')
  fireEvent.change(screen.getByPlaceholderText('Write down your steps here...'), {
    target: { value: '2 + 4 = 6' },
  })
  fireEvent.change(screen.getByPlaceholderText('Enter your final answer'), {
    target: { value: '6' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Submit Problems' }))
}

describe('MathExercise when grading fails', () => {
  beforeEach(() => {
    global.fetch = jest.fn()
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  it('shows the grading error and keeps the child\'s answers on an HTTP error', async () => {
    global.fetch.mockResolvedValueOnce(exerciseResponse).mockResolvedValueOnce(gradeFailure)
    const onSubmit = jest.fn()

    render(<MathExercise onSubmit={onSubmit} />)
    await loadAndAnswer()

    expect(await screen.findByRole('alert')).toHaveTextContent('Nora is unavailable right now')
    expect(screen.queryByText('Problems Graded!')).not.toBeInTheDocument()
    expect(screen.getByPlaceholderText('Enter your final answer')).toHaveValue('6')
    expect(screen.getByPlaceholderText('Write down your steps here...')).toHaveValue('2 + 4 = 6')
    expect(screen.getByRole('button', { name: 'Submit Problems' })).toBeEnabled()
    expect(onSubmit).not.toHaveBeenCalled()
    expect(global.fetch).toHaveBeenCalledTimes(2)
  })

  it('shows an error and keeps the answers when the grade request cannot be sent', async () => {
    global.fetch
      .mockResolvedValueOnce(exerciseResponse)
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
    const onSubmit = jest.fn()

    render(<MathExercise onSubmit={onSubmit} />)
    await loadAndAnswer()

    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(screen.queryByText('Problems Graded!')).not.toBeInTheDocument()
    expect(screen.getByPlaceholderText('Enter your final answer')).toHaveValue('6')
    expect(screen.getByRole('button', { name: 'Submit Problems' })).toBeEnabled()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('lets the child resubmit the same answers after a failure, and clears the error', async () => {
    global.fetch
      .mockResolvedValueOnce(exerciseResponse)
      .mockResolvedValueOnce(gradeFailure)
      .mockResolvedValueOnce(gradeSuccess)
      .mockResolvedValueOnce(librarySave)
    const onSubmit = jest.fn()

    render(<MathExercise onSubmit={onSubmit} />)
    await loadAndAnswer()
    await screen.findByRole('alert')

    fireEvent.click(screen.getByRole('button', { name: 'Submit Problems' }))

    expect(await screen.findByText('Problems Graded!')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    const resubmitBody = JSON.parse(global.fetch.mock.calls[2][1].body)
    expect(resubmitBody.answers.problems[0]).toMatchObject({ id: 1, answer: '6', work: '2 + 4 = 6' })
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
  })
})
