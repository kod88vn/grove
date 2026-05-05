import { describe, it, expect, jest } from '@jest/globals'
import { render, screen } from '@testing-library/react'
import { ChatInput } from './ChatInput'

describe('ChatInput', () => {
  it('uses a short placeholder and shows usage guidance below the input', () => {
    render(
      <ChatInput
        value=""
        onChange={jest.fn()}
        onSubmit={jest.fn()}
        isLoading={false}
      />
    )

    expect(screen.getByPlaceholderText('Message Nora...')).toBeInTheDocument()
    expect(screen.getByTestId('chat-input-hint')).toHaveTextContent('Press Enter to send.')
    expect(screen.getByTestId('chat-input-hint')).toHaveTextContent('Shift+Enter for a new line.')
  })
})