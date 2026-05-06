import { describe, expect, it } from '@jest/globals'

import { withSystemMessage } from './prompt'

describe('withSystemMessage', () => {
  it('does not treat injected current time as evidence for real-world event claims', () => {
    const [{ content }] = withSystemMessage([{ role: 'user', content: 'test' }])

    expect(content).not.toContain('Use this as the authoritative current date for all searches and answers')
    expect(content).toContain('Never infer that an event happened "today" from this clock value alone')
  })

  it('includes verification and no-guessing policy for sensitive people claims', () => {
    const [{ content }] = withSystemMessage([{ role: 'user', content: 'test' }])

    expect(content).toContain('strict process: Plan what facts are needed, Execute tool calls, then Verify evidence')
    expect(content).toContain('ALWAYS attempt to verify with web_search first')
    expect(content).toContain('events or figures')
    expect(content).toContain('never guess or invent details')
    expect(content).toContain('avoid vague meta-commentary')
    expect(content).toContain('do not present definitive conclusions')
    expect(content).toContain('If verification is inconclusive, explicitly say you cannot verify')
  })

  it('includes the family location in the system prompt', () => {
    const [{ content }] = withSystemMessage([{ role: 'user', content: 'test' }])
    expect(content).toContain('Family location:')
  })

  it('supports fast profile prompt for non-factual chat routes', () => {
    const [{ content }] = withSystemMessage([{ role: 'user', content: 'test' }], 'fast')

    expect(content).toContain('Keep responses concise')
    expect(content).toContain('Do not perform web/tool verification unless explicitly requested')
  })

  it('injects selected orchestrator skill instructions when provided', () => {
    const [{ content }] = withSystemMessage(
      [{ role: 'user', content: 'test' }],
      'factual',
      { skillPromptPack: 'skill: weather_widget\nReturn strict JSON only.' }
    )

    expect(content).toContain('Selected skill instructions')
    expect(content).toContain('skill: weather_widget')
    expect(content).toContain('Return strict JSON only')
  })
})