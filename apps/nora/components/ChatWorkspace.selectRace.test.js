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
    chats: [
      { id: 'c1', title: 'Fractions', pinned: false, updated_at: 2 },
      { id: 'c2', title: 'Volcanoes', pinned: false, updated_at: 1 },
    ],
    loading: false,
    error: null,
    refresh: jest.fn(),
    pin: jest.fn(async () => true),
    remove: jest.fn(async () => true),
  }),
}))

// Each fetchChatDetail call returns a promise the test settles by hand.
const mockPending = {}
jest.mock('@/lib/api/chats', () => ({
  fetchChatDetail: (id) =>
    new Promise((resolve, reject) => {
      mockPending[id] = { resolve, reject }
    }),
}))

const MESSAGE = "Couldn't open that chat. Please try again."
const openChatId = () => mockOpenChatIds[mockOpenChatIds.length - 1]

async function click(element) {
  await act(async () => {
    fireEvent.click(element)
  })
}

const chatButton = (title) => screen.getAllByText(title)[0]
const newChatButton = () => screen.getAllByRole('button', { name: /New Chat/ })[0]

async function settle(id, outcome) {
  await act(async () => {
    if (outcome === 'fail') mockPending[id].reject(new Error('Failed to load chat: 500'))
    else mockPending[id].resolve({ messages: [] })
  })
}

describe('ChatWorkspace when chat selections overlap', () => {
  let consoleError

  beforeEach(() => {
    mockOpenChatIds.length = 0
    for (const id of Object.keys(mockPending)) delete mockPending[id]
    consoleError = jest.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleError.mockRestore()
  })

  it('ignores a failure from an older selection after a newer one succeeded', async () => {
    render(<ChatWorkspace />)
    await click(chatButton('Fractions'))
    await click(chatButton('Volcanoes'))

    await settle('c2', 'ok')
    await waitFor(() => expect(openChatId()).toBe('c2'))

    await settle('c1', 'fail')
    expect(screen.queryAllByText(MESSAGE)).toHaveLength(0)
    expect(openChatId()).toBe('c2')
  })

  it('ignores a late success from an older selection after a newer one succeeded', async () => {
    render(<ChatWorkspace />)
    await click(chatButton('Fractions'))
    await click(chatButton('Volcanoes'))

    await settle('c2', 'ok')
    await waitFor(() => expect(openChatId()).toBe('c2'))

    await settle('c1', 'ok')
    expect(openChatId()).toBe('c2')
  })

  it('ignores a failure from a selection that New Chat superseded', async () => {
    render(<ChatWorkspace />)
    await click(chatButton('Fractions'))
    await click(newChatButton())

    await settle('c1', 'fail')
    expect(screen.queryAllByText(MESSAGE)).toHaveLength(0)
    expect(openChatId()).toBeNull()
  })

  it('still reports a failure from the latest selection', async () => {
    render(<ChatWorkspace />)
    await click(chatButton('Fractions'))
    await click(chatButton('Volcanoes'))

    await settle('c1', 'ok')
    await settle('c2', 'fail')
    await waitFor(() => expect(screen.getAllByRole('alert')[0]).toHaveTextContent(MESSAGE))
    expect(openChatId()).toBeNull()
  })
})
