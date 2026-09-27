import { render, screen } from '@testing-library/react'
import { ChatWorkspace } from './ChatWorkspace'

jest.mock('@/hooks/useChatMessages', () => ({
  useChatMessages: () => ({
    messages: [],
    isStreaming: false,
    sendMessage: jest.fn(),
    triggerGreeting: jest.fn(),
    chatIdRef: { current: null },
  }),
}))

jest.mock('@/hooks/useModels', () => ({
  useModels: () => ({ modelList: [], selectedModel: 'm1', setSelectedModel: jest.fn() }),
}))

jest.mock('@/components/GreetingTrigger', () => ({ GreetingTrigger: () => null }))

jest.mock('@/hooks/useChatHistory', () => ({
  useChatHistory: () => ({
    chats: [],
    loading: true,
    error: null,
    refresh: jest.fn(),
    pin: jest.fn(),
    remove: jest.fn(),
  }),
}))

jest.mock('@/lib/api/chats', () => ({ fetchChatDetail: jest.fn() }))

describe('ChatWorkspace history loading', () => {
  it('tells the sidebar the history is still loading', () => {
    render(<ChatWorkspace />)
    expect(screen.getAllByText('Loading chats…').length).toBeGreaterThan(0)
    expect(screen.queryAllByText('No chats yet')).toHaveLength(0)
  })
})
