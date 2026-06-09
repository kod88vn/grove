// Integration test: verify that when AI_PROVIDER=lmstudio, the correct model name is used everywhere.
// This test simulates the full flow from client → server → LMStudio client.

import { afterAll, beforeEach, describe, expect, it, jest } from '@jest/globals'
import { ReadableStream as NodeReadableStream } from 'node:stream/web'

// Polyfill for Node.js test environment
// Polyfill for Node.js test environment - Response is used by lmsstudioClient at line 224
global.Response = global.Response || class Response {
  constructor(body, init) { this.body = body; this.status = init?.status || 200 }
}
global.ReadableStream = global.ReadableStream || NodeReadableStream

describe('Model resolution for LMStudio', () => {
  const originalEnv = process.env

  beforeEach(() => {
    jest.resetModules()
    // Set up LMStudio environment exactly as in .env.local (consolidated)
    process.env = {
      ...originalEnv,
      AI_PROVIDER: 'lmstudio',
      LMSTUDIO_BASE_URL: 'http://localhost:1234/v1',
      MODEL: 'qwen3.6-35b-a3b-mtp-holo3-qwopus-qx86-hi-mlx',
      NEXT_PUBLIC_MODEL: 'qwen3.6-35b-a3b-mtp-holo3-qwopus-qx86-hi-mlx',
    }
  })

  afterAll(() => {
    process.env = originalEnv
  })

  it('server-side constants.js returns the LMStudio model when freshly loaded', () => {
    // Fresh import after env is set
    const constants = require('./constants')
    expect(constants.DEFAULT_MODEL).toBe('qwen3.6-35b-a3b-mtp-holo3-qwopus-qx86-hi-mlx')
  })

  it('when route passes DEFAULT_MODEL from constants, LMStudio receives correct model', async () => {
    // Mock fetch with proper Response shape using global.Response polyfill
    const mockResponse = {
      ok: true,
      status: 200,
      async json() { return { message: { content: 'test response' }, done: true } },
      clone() { return mockResponse },
    }
    global.fetch = jest.fn().mockResolvedValue(mockResponse)

    const constants = require('./constants')
    const { callAI } = require('./callAI')

    // Simulate what route.js does: pass DEFAULT_MODEL to callAI
    await callAI({
      model: constants.DEFAULT_MODEL, // This is what the route passes
      messages: [{ role: 'user', content: 'test' }],
      stream: false,
    })

    expect(global.fetch).toHaveBeenCalled()
    const callArgs = global.fetch.mock.calls[0]
    const body = JSON.parse(callArgs[1].body)

    // CRITICAL: LMStudio should receive qwen3.6-35b-a3b-mtp-holo3-qwopus-qx86-hi-mlx, NOT qwen3.5:9b
    expect(body.model).toBe('qwen3.6-35b-a3b-mtp-holo3-qwopus-qx86-hi-mlx')
    expect(body.model).not.toBe('qwen3.5:9b')
  })

  it('verifies the fix: no hardcoded qwen3.5:9b in production useChat.js', () => {
    const fs = require('fs')
    const path = require('path')

    // Test is at apps/nora/app/api/chat/lib/modelResolution.test.js
    // useChat.js is at apps/nora/lib/useChat.js (two levels up from app/)
    const useChatPath = path.join(__dirname, '../../../../lib/useChat.js')
    const content = fs.readFileSync(useChatPath, 'utf-8')

    // The file should import DEFAULT_MODEL from hooks/defaultModel
    expect(content).toContain("from '../hooks/defaultModel.js'")

    // The file should NOT have hardcoded 'qwen3.5:9b' as a model value
    expect(content).not.toMatch(/model:\s*['"]qwen3\.5:9b['"]/)

    // The file should use DEFAULT_MODEL variable
    expect(content).toMatch(/model:\s*DEFAULT_MODEL/)
  })

  it('verifies the fix: no hardcoded qwen3.5:9b in production FloatingChat.js', () => {
    const fs = require('fs')
    const path = require('path')

    const componentPath = path.join(__dirname, '../../../../components/FloatingChat.js')
    const content = fs.readFileSync(componentPath, 'utf-8')

    // Should import DEFAULT_MODEL from hooks
    expect(content).toContain("@/hooks/defaultModel.js")

    // Should NOT have hardcoded model definition
    expect(content).not.toMatch(/const DEFAULT_MODEL = process\.env\..*['"]qwen3\.5:9b/)
  })

  it('verifies the fix: no hardcoded qwen3.5:9b in production useModels.js', () => {
    const fs = require('fs')
    const path = require('path')

    // hooks/useModels is at apps/nora/hooks/ (one level up from app/)
    const hookPath = path.join(__dirname, '../../../../hooks/useModels.js')
    const content = fs.readFileSync(hookPath, 'utf-8')

    // Should import DEFAULT_MODEL from hooks/defaultModel
    expect(content).toContain("from './defaultModel.js'")

    // Should NOT have hardcoded model definition
    expect(content).not.toMatch(/const ENV_DEFAULT = process\.env\..*['"]qwen3\.5:9b/)
  })

  it('verifies the fix: no hardcoded qwen3.5:9b in production models/route.js', () => {
    const fs = require('fs')
    const path = require('path')

    // models/route.js is at apps/nora/app/api/models/ (parent of chat/)
    const routePath = path.join(__dirname, '../../models/route.js')
    const content = fs.readFileSync(routePath, 'utf-8')

    // Should import DEFAULT_MODEL from constants
    expect(content).toContain("from '../chat/lib/constants.js'")

    // Should NOT have hardcoded model definition
    expect(content).not.toMatch(/const DEFAULT_MODEL = process\.env\..*['"]qwen3\.5:9b/)
  })

  it('verifies hooks/defaultModel.js exists and exports correct values', () => {
    const fs = require('fs')
    const path = require('path')

    const defaultModelPath = path.join(__dirname, '../../../../hooks/defaultModel.js')
    expect(fs.existsSync(defaultModelPath)).toBe(true)

    const content = fs.readFileSync(defaultModelPath, 'utf-8')
    expect(content).toContain('export function getDefaultModel')
    expect(content).toContain('export const DEFAULT_MODEL')
  })

  it('verifies .env.local has correct MODEL env var', () => {
    const fs = require('fs')
    const path = require('path')

    // .env.local is at root of grove workspace (5 levels up: lib → chat → api → app → nora)
    const envPath = path.join(__dirname, '../../../../../../.env.local')
    const content = fs.readFileSync(envPath, 'utf-8')

    expect(content).toContain('AI_PROVIDER=lmstudio')
    expect(content).toContain('MODEL=qwen3.6-35b-a3b-mtp-holo3-qwopus-qx86-hi-mlx')
    expect(content).toContain('NEXT_PUBLIC_MODEL=qwen3.6-35b-a3b-mtp-holo3-qwopus-qx86-hi-mlx')
  })
})