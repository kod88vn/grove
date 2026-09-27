import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { ChatWorkspace } from './ChatWorkspace'

// Every render of useChatMessages records the chat id the workspace has open.
const mockOpenChatIds = []
jest.mock('@/hooks/useChatMessages', () => ({
  useChatMessages: ({ initialChatId }) => {
    mockOpenChatIds.push(initialChatId)
    return {
      messages: [],
      isStreaming: false,
      sendMessage: jest.fn(),
      triggerGreeting: jest.fn(),
      chatIdRef: { current: null },
    }
  },
}))

jest.mock('@/hooks/useModels', () => ({
  useModels: () => ({ modelList: [], selectedModel: 'm1', setSelectedModel: jest.fn() }),
}))

jest.mock('@/components/GreetingTrigger', () => ({ GreetingTrigger: () => null }))

jest.mock('@/hooks/useChatHistory', () => ({
  useChatHistory: () => ({
    chats: [{ id: 'c1', title: 'Fractions', pinned: false, updated_at: 1 }],
    loading: false,
    error: null,
    refresh: jest.fn(),
    pin: jest.fn(async () => true),
    remove: jest.fn(async () => true),
  }),
}))

const mockFetchChatDetail = jest.fn()
jest.mock('@/lib/api/chats', () => ({
  fetchChatDetail: (...args) => mockFetchChatDetail(...args),
}))

const MESSAGE = "Couldn't open that chat. Please try again."
const openChatId = () => mockOpenChatIds[mockOpenChatIds.length - 1]

async function clickFractions() {
  await act(async () => {
    fireEvent.click(screen.getAllByText('Fractions')[0])
  })
}

describe('ChatWorkspace when opening a past chat fails', () => {
  let consoleError

  beforeEach(() => {
    mockOpenChatIds.length = 0
    mockFetchChatDetail.mockReset()
    consoleError = jest.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleError.mockRestore()
  })

  it('tells the user the chat could not be opened', async () => {
    mockFetchChatDetail.mockRejectedValue(new Error('Failed to load chat: 500'))
    render(<ChatWorkspace />)
    await clickFractions()
    await waitFor(() => expect(screen.getAllByRole('alert')[0]).toHaveTextContent(MESSAGE))
  })

  it('logs the underlying error instead of swallowing it', async () => {
    const failure = new Error('Failed to load chat: 500')
    mockFetchChatDetail.mockRejectedValue(failure)
    render(<ChatWorkspace />)
    await clickFractions()
    await waitFor(() => expect(consoleError).toHaveBeenCalledWith('Failed to open chat', failure))
  })

  it('keeps the current chat instead of switching to the failed one', async () => {
    mockFetchChatDetail.mockRejectedValue(new Error('Failed to load chat: 500'))
    render(<ChatWorkspace />)
    await clickFractions()
    await waitFor(() => expect(consoleError).toHaveBeenCalled())
    expect(openChatId()).toBeNull()
  })

  it('opens the chat and clears the message when a retry succeeds', async () => {
    mockFetchChatDetail
      .mockRejectedValueOnce(new Error('Failed to load chat: 500'))
      .mockResolvedValueOnce({ messages: [] })
    render(<ChatWorkspace />)
    await clickFractions()
    await waitFor(() => expect(screen.getAllByRole('alert')[0]).toHaveTextContent(MESSAGE))

    await clickFractions()
    await waitFor(() => expect(openChatId()).toBe('c1'))
    expect(screen.queryByText(MESSAGE)).not.toBeInTheDocument()
  })
})
