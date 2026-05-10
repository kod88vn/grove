import { generateExercise, gradeSubmission } from '../lib/ollama'

describe('homeworks Nora client', () => {
  beforeEach(() => {
    global.fetch = jest.fn()
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  it('generateExercise calls the correct Nora endpoint with /chat prefix', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ passage: 'test', questions: [] }),
    })

    const result = await generateExercise('reading', 'english')

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/chat/api/nora-homework/exercise'),
      expect.objectContaining({ method: 'POST' })
    )
    expect(result).toEqual({ passage: 'test', questions: [] })
  })

  it('gradeSubmission calls the correct Nora endpoint with /chat prefix', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ totalScore: 10, maxScore: 10 }),
    })
    const result = await gradeSubmission('reading', 'english', {}, {})
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/chat/api/nora-homework/grade'),
      expect.objectContaining({ method: 'POST' })
    )
    expect(result).toEqual({ totalScore: 10, maxScore: 10 })
  })

  it('throws when Nora returns a non-ok response', async () => {
    global.fetch.mockResolvedValue({
      ok: false,
      status: 502,
      text: async () => 'Bad Gateway',
    })
    await expect(generateExercise('reading', 'english')).rejects.toThrow('Nora API error 502')
  })
})
