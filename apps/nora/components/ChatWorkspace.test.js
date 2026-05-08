import { render, screen } from '@testing-library/react'
import { ChatWorkspace } from '../components/ChatWorkspace.js'

// Mock the hooks
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
  useModels: () => ({
    modelList: ['model1', 'model2'],
    selectedModel: 'model1',
    setSelectedModel: jest.fn(),
  }),
}))

jest.mock('@/hooks/useChatHistory', () => ({
  useChatHistory: () => ({
    chats: [],
    refresh: jest.fn(),
    pin: jest.fn(),
    remove: jest.fn(),
  }),
}))

jest.mock('@/lib/api/chats', () => ({
  fetchChatDetail: jest.fn(),
}))

describe('ChatWorkspace', () => {
  it('renders without crashing', () => {
    render(<ChatWorkspace />)
    expect(screen.getByText('What do you want to learn today?')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Open history' })).toBeInTheDocument()
  })

  // Add more tests as needed, e.g., for interactions
})