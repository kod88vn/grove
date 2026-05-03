import { describe, it, expect } from '@jest/globals'
import { render, screen } from '@testing-library/react'
import { ChatMessage } from '@/components/ChatMessage'

describe('ChatMessage timestamps', () => {
  it('renders timestamp for a user message', () => {
    const timestamp = '2026-05-03T14:25:00.000Z'
    const expected = new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

    render(
      <ChatMessage
        role="user"
        content="Hello Nora"
        timestamp={timestamp}
        thinking=""
        thinkingVisible={false}
        isStreaming={false}
      />
    )

    expect(screen.getByText(expected)).toBeInTheDocument()
  })

  it('renders timestamp for an assistant message', () => {
    const timestamp = '2026-05-03T14:26:00.000Z'
    const expected = new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

    render(
      <ChatMessage
        role="assistant"
        content="Hello there"
        timestamp={timestamp}
        thinking=""
        thinkingVisible={false}
        isStreaming={false}
      />
    )

    expect(screen.getByText(expected)).toBeInTheDocument()
  })
})