import { generateExercise, gradeSubmission } from './ollama'

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

  it('uses PLT_NORA_URL env var when set', async () => {
    const prev = process.env.PLT_NORA_URL
    process.env.PLT_NORA_URL = 'http://custom-nora:9999'
    jest.resetModules()

    global.fetch.mockResolvedValue({ ok: true, json: async () => ({}) })
    const { generateExercise: ge } = await import('./ollama')
    await ge('reading', 'english')

    expect(global.fetch).toHaveBeenCalledWith(
      'http://custom-nora:9999/chat/api/nora-homework/exercise',
      expect.any(Object)
    )

    process.env.PLT_NORA_URL = prev
  })

  it('defaults to port 3000 when PLT_NORA_URL is not set', async () => {
    const prev = process.env.PLT_NORA_URL
    if (process.env.PLT_NORA_URL) delete process.env.PLT_NORA_URL
    jest.resetModules()

    global.fetch.mockResolvedValue({ ok: true, json: async () => ({}) })
    const { generateExercise: ge } = await import('./ollama')
    await ge('reading', 'english')

    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:3000/chat/api/nora-homework/exercise',
      expect.any(Object)
    )

    process.env.PLT_NORA_URL = prev
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
