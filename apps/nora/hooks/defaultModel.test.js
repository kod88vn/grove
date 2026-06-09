// Tests for the shared client-side default model resolver.

import { getDefaultModel, DEFAULT_MODEL } from './defaultModel'

describe('getDefaultModel', () => {
  const originalEnv = process.env

  beforeEach(() => {
    jest.resetModules()
    // Reset environment before each test
    process.env = { ...originalEnv }
  })

  afterAll(() => {
    process.env = originalEnv
  })

  it('returns default model when NEXT_PUBLIC_MODEL is not set', () => {
    delete process.env.NEXT_PUBLIC_MODEL

    const { getDefaultModel: gm } = require('./defaultModel')
    expect(gm()).toBe('qwen3.6-35b-a3b-mtp-holo3-qwopus-qx86-hi-mlx')
  })

  it('uses NEXT_PUBLIC_MODEL when available', () => {
    process.env.NEXT_PUBLIC_MODEL = 'custom/model/name'

    const { getDefaultModel: gm } = require('./defaultModel')
    expect(gm()).toBe('custom/model/name')
  })

  it('returns custom model for any AI_PROVIDER', () => {
    process.env.AI_PROVIDER = 'lmstudio'
    process.env.NEXT_PUBLIC_MODEL = 'custom/provider/model'

    const { getDefaultModel: gm } = require('./defaultModel')
    expect(gm()).toBe('custom/provider/model')
  })
})

describe('DEFAULT_MODEL constant', () => {
  it('is resolved at module load time based on current environment', () => {
    process.env.NEXT_PUBLIC_MODEL = 'test/model'

    // Re-require to pick up new env
    jest.resetModules()
    const { DEFAULT_MODEL: dm } = require('./defaultModel')

    expect(dm).toBe('test/model')
  })
})