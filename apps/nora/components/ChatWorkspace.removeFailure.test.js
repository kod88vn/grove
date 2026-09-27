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

const mockHistory = {}
jest.mock('@/hooks/useChatHistory', () => ({
  useChatHistory: () => mockHistory,
}))

jest.mock('@/lib/api/chats', () => ({
  fetchChatDetail: async () => ({ messages: [] }),
}))

function resetHistory({ removeSucceeds, error = null }) {
  Object.assign(mockHistory, {
    chats: [{ id: 'c1', title: 'Fractions', pinned: false, updated_at: 1 }],
    refresh: jest.fn(),
    pin: jest.fn(async () => true),
    remove: jest.fn(async () => removeSucceeds),
    error,
  })
}

const openChatId = () => mockOpenChatIds[mockOpenChatIds.length - 1]

async function openFractionsThenDelete() {
  render(<ChatWorkspace />)
  fireEvent.click(screen.getAllByText('Fractions')[0])
  await waitFor(() => expect(openChatId()).toBe('c1'))
  await act(async () => {
    fireEvent.click(screen.getAllByTitle('Delete chat')[0])
  })
  await waitFor(() => expect(mockHistory.remove).toHaveBeenCalledWith('c1'))
}

describe('ChatWorkspace when deleting a chat', () => {
  beforeEach(() => {
    mockOpenChatIds.length = 0
  })

  it('keeps the open chat open when the delete fails', async () => {
    resetHistory({ removeSucceeds: false })
    await openFractionsThenDelete()
    expect(openChatId()).toBe('c1')
  })

  it('starts a new chat when the open chat is deleted successfully', async () => {
    resetHistory({ removeSucceeds: true })
    await openFractionsThenDelete()
    await waitFor(() => expect(openChatId()).toBeNull())
  })

  it('shows the chat history error to the user', () => {
    resetHistory({ removeSucceeds: false, error: "Couldn't delete the chat. Please try again." })
    render(<ChatWorkspace />)
    expect(screen.getAllByRole('alert')[0]).toHaveTextContent(
      "Couldn't delete the chat. Please try again."
    )
  })
})
