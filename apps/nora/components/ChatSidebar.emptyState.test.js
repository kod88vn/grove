import { render, screen } from '@testing-library/react'
import { ChatSidebar } from './ChatSidebar'

function renderSidebar(props) {
  return render(
    <ChatSidebar
      chats={[]}
      selectedId={null}
      onSelect={jest.fn()}
      onNew={jest.fn()}
      onPin={jest.fn()}
      onRemove={jest.fn()}
      {...props}
    />
  )
}

describe('ChatSidebar empty state', () => {
  it('says the history is loading instead of claiming there are no chats', () => {
    renderSidebar({ loading: true })
    expect(screen.getAllByRole('status')[0]).toHaveTextContent('Loading chats…')
    expect(screen.queryAllByText('No chats yet')).toHaveLength(0)
  })

  it('says there are no chats once loading finished with an empty history', () => {
    renderSidebar({ loading: false })
    expect(screen.getAllByText('No chats yet').length).toBeGreaterThan(0)
    expect(screen.queryAllByText('Loading chats…')).toHaveLength(0)
  })

  it('does not claim there are no chats when the history failed to load', () => {
    renderSidebar({ loading: false, error: "Couldn't load your chats. Please try again." })
    expect(screen.queryAllByText('No chats yet')).toHaveLength(0)
    expect(screen.getAllByRole('alert')[0]).toHaveTextContent("Couldn't load your chats.")
  })

  it('keeps showing the chats while a refresh is in flight', () => {
    renderSidebar({
      loading: true,
      chats: [{ id: 'c1', title: 'Fractions', pinned: false, updated_at: 1 }],
    })
    expect(screen.getAllByText('Fractions').length).toBeGreaterThan(0)
    expect(screen.queryAllByText('Loading chats…')).toHaveLength(0)
  })
})
