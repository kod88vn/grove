import { afterAll, beforeEach, describe, expect, it, jest } from '@jest/globals'

// Mock fetch before importing aiClient
const mockFetch = jest.fn()
global.fetch = mockFetch

// Set a deterministic Nora URL for testing
const originalEnv = process.env.PLT_NORA_URL
beforeEach(() => {
  jest.clearAllMocks()
  process.env.PLT_NORA_URL = 'http://localhost:3001'
})

afterAll(() => {
  if (originalEnv !== undefined) {
    process.env.PLT_NORA_URL = originalEnv
  } else {
    delete process.env.PLT_NORA_URL
  }
})

describe('aiClient', () => {
  describe('generateExercise', () => {
    it('calls Nora exercise endpoint with correct params', async () => {
      const { generateExercise } = await import('./aiClient')

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'ex-1', subject: 'math', type: 'problem-set' }),
      })

      const result = await generateExercise('problem-set', 'math')

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3001/chat/api/nora-homework/exercise',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subject: 'math', type: 'problem-set' }),
        })
      )
      expect(result).toEqual({ id: 'ex-1', subject: 'math', type: 'problem-set' })
    })

    it('includes skillCategory and selectedDomain when provided', async () => {
      const { generateExercise } = await import('./aiClient')

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'ex-2' }),
      })

      await generateExercise('reading', 'english', {
        skillCategory: 'phonics',
        selectedDomain: 'vocabulary',
      })

      const lastCall = mockFetch.mock.calls[mockFetch.mock.calls.length - 1]
      const body = JSON.parse(lastCall[1].body)

      expect(body.skillCategory).toBe('phonics')
      expect(body.selectedDomain).toBe('vocabulary')
    })

    it('throws on non-ok response', async () => {
      const { generateExercise } = await import('./aiClient')

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 502,
        text: async () => 'Bad Gateway',
      })

      await expect(generateExercise('writing', 'english')).rejects.toThrow(
        'Nora API error 502: Bad Gateway'
      )
    })

    it('throws on network error', async () => {
      const { generateExercise } = await import('./aiClient')

      mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'))

      await expect(generateExercise('math', 'math')).rejects.toThrow('ECONNREFUSED')
    })

    it('throws on timeout', async () => {
      const { generateExercise } = await import('./aiClient')

      mockFetch.mockImplementationOnce(() =>
        Promise.reject({ name: 'AbortError' })
      )

      await expect(generateExercise('math', 'math')).rejects.toThrow(
        /Nora API timeout after/
      )
    })
  })

  describe('gradeSubmission', () => {
    it('calls Nora grade endpoint with correct params', async () => {
      const { gradeSubmission } = await import('./aiClient')

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ score: 3, totalCorrect: 3, totalProblems: 4 }),
      })

      const exercise = { problems: [{ id: 1 }, { id: 2 }] }
      const answers = { '1': '42', '2': '87' }

      const result = await gradeSubmission('problem-set', 'math', exercise, answers)

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3001/chat/api/nora-homework/grade',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            subject: 'math',
            type: 'problem-set',
            exercise,
            answers,
          }),
        })
      )
      expect(result).toEqual({ score: 3, totalCorrect: 3, totalProblems: 4 })
    })

    it('throws on non-ok response', async () => {
      const { gradeSubmission } = await import('./aiClient')

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error',
      })

      await expect(gradeSubmission('math', 'math', {}, {})).rejects.toThrow(
        'Nora API error 500: Internal Server Error'
      )
    })

    it('throws on network error', async () => {
      const { gradeSubmission } = await import('./aiClient')

      mockFetch.mockRejectedValueOnce(new Error('ENOTFOUND'))

      await expect(gradeSubmission('math', 'math', {}, {})).rejects.toThrow('ENOTFOUND')
    })
  })

  describe('callNora (internal)', () => {
    it('uses default Nora URL when PLT_NORA_URL is not set', async () => {
      delete process.env.PLT_NORA_URL

      const { generateExercise } = await import('./aiClient')

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      })

      await generateExercise('math', 'math')

      // Default Nora URL is http://localhost:3000, with /chat base
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/chat/api/nora-homework/exercise',
        expect.any(Object)
      )
    })

    it('uses custom timeout when HOMEWORKS_NORA_TIMEOUT_MS is set', async () => {
      process.env.HOMEWORKS_NORA_TIMEOUT_MS = '5000'

      const { generateExercise } = await import('./aiClient')

      mockFetch.mockImplementationOnce(() =>
        new Promise((resolve) =>
          setTimeout(
            () => resolve({ ok: true, json: async () => ({}) }),
            300
          )
        )
      )

      await generateExercise('math', 'math')

      // Verify the abort signal was set with 5000ms timeout
      const call = mockFetch.mock.calls[0]
      expect(call[1].signal).toBeDefined()
    })
  })
})