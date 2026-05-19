import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'
import '@testing-library/jest-dom'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

import { EnglishExercise } from './EnglishExercise'
import { MathExercise } from './MathExercise'

describe('exercise resubmission flow', () => {
  beforeEach(() => {
    global.fetch = jest.fn()
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  it('allows revising and resubmitting english answers', async () => {
    global.fetch
      // 1. loadTopics() calls /chat/api/nora-homework/topics
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ topics: [], categories: [] }),
      })
      // 2. fetchExercise() calls /homeworks/api/exercises?... (first exercise)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          exercise: {
            passage: 'A short passage.',
            questions: [
              { id: 1, type: 'short-answer', question: 'What happened?' },
            ],
          },
        }),
      })
      // 3. First submit grade → /homeworks/api/grade
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          gradeResult: { answers: [{ id: 1, score: 0, feedback: 'Try again' }] },
          score: 0,
          maxScore: 1,
          percentage: 0,
          feedback: 'Please revise',
        }),
      })
      // 4. First save to reading history → /homeworks/api/reading-history
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'rh-1' }) })
      // 5. Second exercise fetch (after "Try Another Exercise") → /homeworks/api/exercises?...
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          exercise: {
            passage: 'A new passage for retry.',
            questions: [
              { id: 2, type: 'short-answer', question: 'What happened this time?' },
            ],
          },
        }),
      })

    render(<EnglishExercise />)

    // Click "New Exercise" button which opens the topic modal
    fireEvent.click(screen.getByRole('button', { name: /✏️ New Exercise/ }))

    // Modal appears on top; select Random to proceed
    await screen.findByText('Choose a Reading Topic')
    fireEvent.click(screen.getByText('🎲 Random (Surprise me!)'))

    await screen.findByText('Comprehension Questions')

    const answerInput = screen.getByPlaceholderText('Type your answer here...')
    fireEvent.change(answerInput, { target: { value: 'My first answer' } })

    fireEvent.click(screen.getByRole('button', { name: 'Submit Answers' }))

    await screen.findByText('Exercise Graded!')

    // No "Revise and Resubmit" button exists anymore.
    // Clicking "Try Another Exercise" clears everything and goes back to the empty state, then opens modal for new exercise.
    fireEvent.click(screen.getByRole('button', { name: 'Try Another Exercise' }))

    // Modal appears again for a new exercise
    await screen.findByText('Choose a Reading Topic')
    fireEvent.click(screen.getByText('🎲 Random (Surprise me!)'))

    // New exercise loads with fresh answers
    await screen.findByText('Comprehension Questions')

    // Total fetches: loadTopics + exercise(first) + grade(1st submit) + history save(first) + exercise(new) = 5
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(5)
    })

    // Answer the second exercise and submit again for "revise" flow
    const answerInput2 = screen.getByPlaceholderText('Type your answer here...')
    fireEvent.change(answerInput2, { target: { value: 'Improved answer' } })

    global.fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          gradeResult: { answers: [{ id: 2, score: 1, feedback: 'Good again' }] },
          score: 1,
          maxScore: 1,
          percentage: 100,
          feedback: 'Great revision!',
        }),
      })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'rh-2' }) })

    fireEvent.click(screen.getByRole('button', { name: 'Submit Answers' }))

    await screen.findByText('Exercise Graded!')

    // 5 + grade(2nd) + history save(2nd) = 7
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(7)
    })
  })

  it('allows revising and resubmitting math work', async () => {
    global.fetch
      // 1. load first exercise
      .mockResolvedValueOnce({
        ok: true,
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
      })
      // 2. grade first submission (wrong)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          gradeResult: {
            totalCorrect: 0,
            totalProblems: 1,
            comment: 'Check your arithmetic',
            problems: [{ id: 1, correct: false, workShown: true, feedback: 'Try again' }],
          },
          score: 0, maxScore: 1, percentage: 0, feedback: 'Please revise',
        }),
      })
      // 3. library save after first submission
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'lib-1', success: true }) })
      // 4. load second exercise
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          exercise: {
            problems: [{
              id: 2,
              problem: '3 + 6',
              operations: ['addition'],
              skillCategory: 'addition-subtraction',
              skillName: 'Add Whole Numbers',
              skillLabel: '➕ Add Whole Numbers',
            }],
          },
        }),
      })
      // 5. grade second submission (correct)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          gradeResult: {
            totalCorrect: 1,
            totalProblems: 1,
            comment: 'Great correction',
            problems: [{ id: 2, correct: true, workShown: true, feedback: 'Well done' }],
          },
          score: 1, maxScore: 1, percentage: 100, feedback: 'Great correction',
        }),
      })
      // 6. library save after second submission
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'lib-2', success: true }) })

    render(<MathExercise />)

    // Load first exercise
    fireEvent.click(screen.getByRole('button', { name: 'Start Math Problems' }))
    await screen.findByText('Problem 1')

    // Fill in and submit (wrong answer)
    fireEvent.change(screen.getByPlaceholderText('Write down your steps here...'), {
      target: { value: '6 + 4 = 10' },
    })
    fireEvent.change(screen.getByPlaceholderText('Enter your final answer'), {
      target: { value: '9' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Submit Problems' }))

    // Grade result shows
    await screen.findByText('Problems Graded!')

    // No "Revise and Resubmit" button exists anymore.
    fireEvent.click(screen.getByRole('button', { name: 'Try Another Problem Set' }))

    // Back to empty state, load a new exercise
    await screen.findByRole('button', { name: 'Start Math Problems' })
    fireEvent.click(screen.getByRole('button', { name: 'Start Math Problems' }))
    await screen.findByText('Problem 1')

    // Fill in answer for second exercise before submitting
    fireEvent.change(screen.getByPlaceholderText('Enter your final answer'), {
      target: { value: '9' },
    })

    // Submit second exercise (correct answer)
    fireEvent.click(screen.getByRole('button', { name: 'Submit Problems' }))
    await screen.findByText('Problems Graded!')

    // Verify fetch calls: exercise(1) + grade(2) + library-save(3) + exercise(4) + grade(5) + library-save(6)
    expect(global.fetch).toHaveBeenCalledTimes(6)
  })

  it('renders column method grid and submits multiplication answers', async () => {
    global.fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          exercise: {
            problems: [
              {
                id: 1,
                problem: '24 * 38 = ?',
                problemType: 'column-method',
                operands: ['24', '38'],
                operator: '*',
                operations: ['multiplication'],
                expectedAnswer: '912',
                difficulty: 'medium',
                skillCategory: 'multiplication',
                skillName: 'Long Multiplication',
                skillLabel: '✖️ Long Multiplication',
              },
            ],
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          gradeResult: {
            totalCorrect: 1,
            totalProblems: 1,
            comment: 'Good job',
            problems: [{ id: 1, correct: true, workShown: true, feedback: 'Nice steps' }],
          },
          score: 1,
          maxScore: 1,
          percentage: 100,
          feedback: 'Good job',
        }),
      })
      // Mock for library save
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'lib-1', success: true }),
      })

    render(<MathExercise />)

    fireEvent.click(screen.getByRole('button', { name: 'Start Math Problems' }))

    await screen.findByText('Long Multiplication: fill each digit box')

    // Partial product 1 (24 × 8 = 192): fills H, T, O columns
    const pp1H = screen.getByLabelText('Partial product 1 digit H')
    const pp1T = screen.getByLabelText('Partial product 1 digit T')
    const pp1O = screen.getByLabelText('Partial product 1 digit O')

    // Partial product 2 (24 × 3 = 72, shift 1): fills H, T columns; O is static '0'
    const pp2H = screen.getByLabelText('Partial product 2 digit H')
    const pp2T = screen.getByLabelText('Partial product 2 digit T')

    const answerHundreds = screen.getByLabelText('Answer digit H')
    const answerTens = screen.getByLabelText('Answer digit T')
    const answerOnes = screen.getByLabelText('Answer digit O')

    expect(answerHundreds).toBeRequired()
    expect(answerTens).toBeRequired()
    expect(answerOnes).toBeRequired()

    fireEvent.change(pp1H, { target: { value: '1' } })
    fireEvent.change(pp1T, { target: { value: '9' } })
    fireEvent.change(pp1O, { target: { value: '2' } })
    fireEvent.change(pp2H, { target: { value: '7' } })
    fireEvent.change(pp2T, { target: { value: '2' } })
    fireEvent.change(answerHundreds, { target: { value: '9' } })
    fireEvent.change(answerTens, { target: { value: '1' } })
    fireEvent.change(answerOnes, { target: { value: '2' } })

    fireEvent.click(screen.getByRole('button', { name: 'Submit Problems' }))

    await screen.findByText('Problems Graded!')

    const secondCallBody = JSON.parse(global.fetch.mock.calls[1][1].body)
    expect(secondCallBody.answers.problems[0].answer).toBe('912')
    expect(secondCallBody.answers.problems[0].work).toBe(
      JSON.stringify({
        digits: { 0: '9', 1: '1', 2: '2' },
        carries: { pp0_0: '1', pp0_1: '9', pp0_2: '2', pp1_0: '7', pp1_1: '2' },
      })
    )
  })

  it('renders column method grid and submits division answers', async () => {
    global.fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          exercise: {
            problems: [
              {
                id: 1,
                problem: '84 ÷ 7 = ?',
                problemType: 'column-method',
                operands: ['84', '7'],
                operator: '/',
                operations: ['division'],
                expectedAnswer: '12',
                difficulty: 'medium',
              },
            ],
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          gradeResult: {
            totalCorrect: 1,
            totalProblems: 1,
            comment: 'Good job',
            problems: [{ id: 1, correct: true, workShown: true, feedback: 'Nice steps' }],
          },
          score: 1,
          maxScore: 1,
          percentage: 100,
          feedback: 'Good job',
        }),
      })
      // Mock for library save after grading
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'lib-1', success: true }),
      })

    render(<MathExercise />)

    fireEvent.click(screen.getByRole('button', { name: 'Start Math Problems' }))

    await screen.findByText('Long Division: fill each digit box')
    expect(screen.getByText('84 ÷ 7 = ?')).toBeInTheDocument()

    const quotientTens = screen.getByLabelText('Quotient digit T')
    const quotientOnes = screen.getByLabelText('Quotient digit O')

    // Step 1: 8 ÷ 7 → quotient digit 1, subtraction = 7 (single digit)
    const step1Sub1 = screen.getByLabelText('Step 1 subtraction digit 1')
    expect(step1Sub1).toBeRequired()
    expect(screen.queryByLabelText('Step 1 subtraction digit 2')).toBeNull()

    // Step 2: 14 ÷ 7 → quotient digit 2, subtraction = 14 (two digits)
    const step2Sub1 = screen.getByLabelText('Step 2 subtraction digit 1')
    const step2Sub2 = screen.getByLabelText('Step 2 subtraction digit 2')
    expect(step2Sub1).toBeRequired()
    expect(step2Sub2).toBeRequired()

    // Working value between steps (bring-down 14) is rendered statically
    const workingRow = screen.getByTestId('working-2')
    expect(workingRow).toHaveTextContent('14')

    // Final remainder 0 is rendered statically
    expect(screen.getByTestId('final-remainder')).toHaveTextContent('0')

    fireEvent.change(quotientTens, { target: { value: '1' } })
    fireEvent.change(quotientOnes, { target: { value: '2' } })
    fireEvent.change(step1Sub1, { target: { value: '7' } })
    fireEvent.change(step2Sub1, { target: { value: '1' } })
    fireEvent.change(step2Sub2, { target: { value: '4' } })

    fireEvent.click(screen.getByRole('button', { name: 'Submit Problems' }))

    await screen.findByText('Problems Graded!')

    const secondCallBody = JSON.parse(global.fetch.mock.calls[1][1].body)
    expect(secondCallBody.answers.problems[0].answer).toBe('12')
    expect(secondCallBody.answers.problems[0].work).toBe(
      JSON.stringify({
        digits: { 0: '1', 1: '2' },
        carries: { step1_0: '7', step2_0: '1', step2_1: '4' },
      })
    )
  })

  it('aligns long division steps under the correct dividend columns when leading quotient digit is zero', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        exercise: {
          problems: [
            {
              id: 1,
              problem: 'A factory packs 432 items into boxes of 12. How many full boxes?',
              problemType: 'column-method',
              operands: ['432', '12'],
              operator: '/',
              operations: ['division'],
              expectedAnswer: '36',
              difficulty: 'medium',
            },
          ],
        },
      }),
    })

    render(<MathExercise />)

    fireEvent.click(screen.getByRole('button', { name: 'Start Math Problems' }))
    await screen.findByText('Long Division: fill each digit box')

    // 432 / 12 = 36 → leading quotient digit (hundreds) is 0 and is suppressed.
    // Two visible quotient inputs over the tens & ones columns of the dividend.
    expect(screen.getByLabelText('Quotient digit T')).toBeInTheDocument()
    expect(screen.getByLabelText('Quotient digit O')).toBeInTheDocument()
    expect(screen.queryByLabelText('Quotient digit H')).toBeNull()

    // Step 1 (43 ÷ 12 → 3): subtraction is 36 (two digits)
    expect(screen.getByLabelText('Step 1 subtraction digit 1')).toBeInTheDocument()
    expect(screen.getByLabelText('Step 1 subtraction digit 2')).toBeInTheDocument()
    expect(screen.queryByLabelText('Step 1 subtraction digit 3')).toBeNull()

    // Working value 72 is rendered before step 2 (the bring-down of remainder 7 with dividend's 2)
    expect(screen.getByTestId('working-2')).toHaveTextContent('72')

    // Step 2 (72 ÷ 12 → 6): subtraction is 72 (two digits)
    expect(screen.getByLabelText('Step 2 subtraction digit 1')).toBeInTheDocument()
    expect(screen.getByLabelText('Step 2 subtraction digit 2')).toBeInTheDocument()

    // Final remainder = 0
    expect(screen.getByTestId('final-remainder')).toHaveTextContent('0')
  })

  it('presents math problems as narrative word problems with highlighted numbers', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        exercise: {
          problems: [
            {
              id: 1,
              problem:
                'Maya is helping her mother pack cookies for the school fair. She fills 24 trays with 38 cookies on each tray. How many cookies has she packed in total?',
              problemType: 'standard',
              operands: [],
              operator: '',
              operations: ['multiplication'],
              expectedAnswer: '912',
              difficulty: 'medium',
            },
          ],
        },
      }),
    })

    render(<MathExercise />)

    fireEvent.click(screen.getByRole('button', { name: 'Start Math Problems' }))

    // Narrative card label
    await screen.findByText('Word Problem #1')

    // Full narrative sentence is rendered
    expect(
      screen.getByText(/Maya is helping her mother pack cookies/i)
    ).toBeInTheDocument()
    expect(screen.getByText(/How many cookies has she packed in total/i)).toBeInTheDocument()

    // Numbers in the narrative are highlighted as <strong> elements
    const highlighted24 = screen.getAllByText('24').find((el) => el.tagName === 'STRONG')
    const highlighted38 = screen.getAllByText('38').find((el) => el.tagName === 'STRONG')
    expect(highlighted24).toBeInTheDocument()
    expect(highlighted38).toBeInTheDocument()

    // "Numbers:" pill row lists the extracted numbers
    expect(screen.getByText(/^Numbers:/)).toBeInTheDocument()
  })
})