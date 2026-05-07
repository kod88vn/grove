import { describe, it, expect, jest, beforeEach } from '@jest/globals'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ReadableStream as NodeReadableStream } from 'node:stream/web'
import { TextEncoder as NodeTextEncoder, TextDecoder as NodeTextDecoder } from 'node:util'

jest.mock('@/components/GreetingTrigger', () => ({
  GreetingTrigger: () => null,
}))

import { FloatingChat } from './FloatingChat'

if (!global.TextDecoder) global.TextDecoder = NodeTextDecoder
if (!global.ReadableStream) global.ReadableStream = NodeReadableStream

// usePathname is globally mocked in jest.setup.js
const mockUsePathname = jest.requireMock('next/navigation').usePathname

/** Build a fake SSE fetch response with the given word tokens */
function makeSseResponse(...words) {
  const encoder = new NodeTextEncoder()
  const body = new NodeReadableStream({
    start(controller) {
      for (const w of words) controller.enqueue(encoder.encode(`data: ${JSON.stringify({ word: w })}\n\n`))
      controller.close()
    },
  })
  return { ok: true, body }
}

describe('FloatingChat', () => {
  function renderFloatingChat() {
    return render(<FloatingChat enableGreeting={false} />)
  }

  beforeEach(() => {
    mockUsePathname.mockReturnValue('/')
    global.fetch = jest.fn()
  })

  it('renders the floating chat button', () => {
    renderFloatingChat()
    expect(screen.getByRole('button', { name: 'Ask Nora' })).toBeInTheDocument()
  })

  it('returns nothing on the /chat route', () => {
    mockUsePathname.mockReturnValue('/chat')
    const { container } = renderFloatingChat()
    expect(container).toBeEmptyDOMElement()
  })

  it('shows on /modules route', () => {
    mockUsePathname.mockReturnValue('/modules')
    renderFloatingChat()
    expect(screen.getByRole('button', { name: 'Ask Nora' })).toBeInTheDocument()
  })

  it('opens the drawer when the button is clicked', () => {
    renderFloatingChat()
    fireEvent.click(screen.getByRole('button', { name: 'Ask Nora' }))
    expect(screen.getByRole('dialog', { name: 'Ask Nora' })).toBeInTheDocument()
    // Button label flips to close
    expect(screen.getByRole('button', { name: 'Close Nora chat' })).toBeInTheDocument()
  })

  it('closes the drawer via the header close button', () => {
    renderFloatingChat()
    fireEvent.click(screen.getByRole('button', { name: 'Ask Nora' }))
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('button', { name: 'Close Nora chat' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Ask Nora' })).toBeInTheDocument()
  })

  it('closes when clicking the backdrop', () => {
    renderFloatingChat()
    fireEvent.click(screen.getByRole('button', { name: 'Ask Nora' }))
    const backdrop = document.querySelector('[aria-hidden="true"]')
    fireEvent.click(backdrop)
    expect(screen.getByRole('button', { name: 'Ask Nora' })).toBeInTheDocument()
  })

  it('closes on Escape key when open', () => {
    renderFloatingChat()
    fireEvent.click(screen.getByRole('button', { name: 'Ask Nora' }))
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.getByRole('button', { name: 'Ask Nora' })).toBeInTheDocument()
  })

  it('shows empty-state prompt when no messages', () => {
    renderFloatingChat()
    fireEvent.click(screen.getByRole('button', { name: 'Ask Nora' }))
    expect(screen.getByText(/Ask me anything/i)).toBeInTheDocument()
  })

  it('send button is disabled when input is empty', () => {
    renderFloatingChat()
    fireEvent.click(screen.getByRole('button', { name: 'Ask Nora' }))
    expect(screen.getByRole('button', { name: 'Send message' })).toBeDisabled()
  })

  it('send button becomes enabled when input has text', () => {
    renderFloatingChat()
    fireEvent.click(screen.getByRole('button', { name: 'Ask Nora' }))
    fireEvent.change(screen.getByPlaceholderText('Message Nora…'), { target: { value: 'Hello' } })
    expect(screen.getByRole('button', { name: 'Send message' })).not.toBeDisabled()
  })

  it('shows user message and calls /api/chat when Send is clicked', async () => {
    global.fetch.mockImplementation((url, options) => {
      if (url === '/api/chats' && options?.method === 'POST') {
        return Promise.resolve({ ok: true, json: async () => ({ id: 'chat-1' }) })
      }
      if (url === '/api/chat' && options?.method === 'POST') {
        return Promise.resolve(makeSseResponse('Hi!'))
      }
      return Promise.resolve({ ok: false, json: async () => ({ error: 'Request failed' }) })
    })

    renderFloatingChat()
    fireEvent.click(screen.getByRole('button', { name: 'Ask Nora' }))
    fireEvent.change(screen.getByPlaceholderText('Message Nora…'), { target: { value: 'Hello' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }))

    // User message appears as soon as send() runs (before the async fetch)
    await waitFor(() => expect(screen.getByText('Hello')).toBeInTheDocument())

    // Fetch is called with the correct payload
    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/chat',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"Hello"'),
        })
      )
    )
  })

  it('shows error message when fetch fails', async () => {
    global.fetch.mockImplementation((url, options) => {
      if (url === '/api/chats' && options?.method === 'POST') {
        return Promise.resolve({ ok: true, json: async () => ({ id: 'chat-1' }) })
      }
      if (url === '/api/chat' && options?.method === 'POST') {
        return Promise.resolve({ ok: false, json: async () => ({ error: 'Request failed' }) })
      }
      return Promise.resolve({ ok: false, json: async () => ({ error: 'Request failed' }) })
    })

    renderFloatingChat()
    fireEvent.click(screen.getByRole('button', { name: 'Ask Nora' }))
    fireEvent.change(screen.getByPlaceholderText('Message Nora…'), { target: { value: 'Hello' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }))

    await waitFor(() => {
      expect(screen.getByText('Error: Request failed')).toBeInTheDocument()
    })
  })

  it('clears the input after sending', async () => {
    global.fetch.mockImplementation((url, options) => {
      if (url === '/api/chats' && options?.method === 'POST') {
        return Promise.resolve({ ok: true, json: async () => ({ id: 'chat-1' }) })
      }
      if (url === '/api/chat' && options?.method === 'POST') {
        return Promise.resolve(makeSseResponse('Ok'))
      }
      return Promise.resolve({ ok: false, json: async () => ({ error: 'Request failed' }) })
    })

    renderFloatingChat()
    fireEvent.click(screen.getByRole('button', { name: 'Ask Nora' }))
    const textarea = screen.getByPlaceholderText('Message Nora…')
    fireEvent.change(textarea, { target: { value: 'Hello' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }))

    await waitFor(() => {
      expect(textarea.value).toBe('')
    })
  })

  it('sends on Enter key (without Shift)', async () => {
    global.fetch.mockImplementation((url, options) => {
      if (url === '/api/chats' && options?.method === 'POST') {
        return Promise.resolve({ ok: true, json: async () => ({ id: 'chat-1' }) })
      }
      if (url === '/api/chat' && options?.method === 'POST') {
        return Promise.resolve(makeSseResponse('Ok'))
      }
      return Promise.resolve({ ok: false, json: async () => ({ error: 'Request failed' }) })
    })

    renderFloatingChat()
    fireEvent.click(screen.getByRole('button', { name: 'Ask Nora' }))
    const textarea = screen.getByPlaceholderText('Message Nora…')
    fireEvent.change(textarea, { target: { value: 'Hello' } })
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })

    await waitFor(() => {
      expect(screen.getByText('Hello')).toBeInTheDocument()
    })
  })

  it('does not send on Shift+Enter', async () => {
    renderFloatingChat()
    fireEvent.click(screen.getByRole('button', { name: 'Ask Nora' }))
    const textarea = screen.getByPlaceholderText('Message Nora…')
    fireEvent.change(textarea, { target: { value: 'Hello' } })
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true })

    // fetch should NOT have been called
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('does not send when input is whitespace only', async () => {
    renderFloatingChat()
    fireEvent.click(screen.getByRole('button', { name: 'Ask Nora' }))
    const textarea = screen.getByPlaceholderText('Message Nora…')
    fireEvent.change(textarea, { target: { value: '   ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }))

    expect(global.fetch).not.toHaveBeenCalled()
  })
})
