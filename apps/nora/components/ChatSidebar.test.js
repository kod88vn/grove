import { describe, it, expect, jest } from '@jest/globals'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { ChatSidebar } from './ChatSidebar'

const chats = [
  { id: 'c1', title: 'First chat', updated_at: Math.floor(Date.now() / 1000), pinned: false },
]

describe('ChatSidebar', () => {
  it('keeps the mobile overlay hidden by default', () => {
    render(
      <ChatSidebar
        chats={chats}
        selectedId={null}
        onSelect={jest.fn()}
        onNew={jest.fn()}
        onPin={jest.fn()}
        onRemove={jest.fn()}
        isMobileOpen={false}
        onClose={jest.fn()}
      />
    )

    expect(screen.getByTestId('mobile-sidebar-overlay')).toHaveClass('hidden')
  })

  it('shows a full-screen mobile overlay when opened', () => {
    render(
      <ChatSidebar
        chats={chats}
        selectedId={null}
        onSelect={jest.fn()}
        onNew={jest.fn()}
        onPin={jest.fn()}
        onRemove={jest.fn()}
        isMobileOpen={true}
        onClose={jest.fn()}
      />
    )

    const overlay = screen.getByTestId('mobile-sidebar-overlay')
    expect(overlay).toHaveClass('fixed')
    expect(overlay).toHaveClass('inset-0')
  })

  it('calls onClose when tapping the backdrop on mobile', () => {
    const onClose = jest.fn()

    render(
      <ChatSidebar
        chats={chats}
        selectedId={null}
        onSelect={jest.fn()}
        onNew={jest.fn()}
        onPin={jest.fn()}
        onRemove={jest.fn()}
        isMobileOpen={true}
        onClose={onClose}
      />
    )

    const closeButtons = screen.getAllByLabelText('Close history')
    fireEvent.click(closeButtons[0])
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('keeps selecting a chat wired inside the mobile overlay', () => {
    const onSelect = jest.fn()

    render(
      <ChatSidebar
        chats={chats}
        selectedId={null}
        onSelect={onSelect}
        onNew={jest.fn()}
        onPin={jest.fn()}
        onRemove={jest.fn()}
        isMobileOpen={true}
        onClose={jest.fn()}
      />
    )

    const overlay = screen.getByTestId('mobile-sidebar-overlay')
    fireEvent.click(within(overlay).getByText('First chat'))
    expect(onSelect).toHaveBeenCalledWith(chats[0])
  })
})