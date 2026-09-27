import { render, screen, fireEvent, within } from '@testing-library/react'
import { ChatSidebar } from './ChatSidebar'

const NOW = Math.floor(Date.now() / 1000)
const CHATS = [
  { id: 'c1', title: 'Fractions', pinned: false, updated_at: NOW },
  { id: 'c2', title: 'Volcanoes', pinned: true, updated_at: NOW },
]

function renderSidebar(overrides = {}) {
  const props = {
    chats: CHATS,
    selectedId: 'c2',
    onSelect: jest.fn(),
    onNew: jest.fn(),
    onPin: jest.fn(),
    onRemove: jest.fn(),
    ...overrides,
  }
  render(<ChatSidebar {...props} />)
  return props
}

// The sidebar renders the list twice (mobile overlay + desktop aside); use the desktop copy.
function desktop() {
  return within(screen.getByTestId('desktop-sidebar'))
}

function chatButton(title) {
  return desktop().getByRole('button', { name: new RegExp(`^${title}`) })
}

describe('ChatSidebar keyboard access', () => {
  it('exposes each past chat as a focusable button named by its title', () => {
    renderSidebar()

    for (const { title } of CHATS) {
      const button = chatButton(title)
      expect(button.tagName).toBe('BUTTON')
      button.focus()
      expect(button).toHaveFocus()
    }
  })

  it('opens the chat when its button is activated', () => {
    const props = renderSidebar()

    fireEvent.click(chatButton('Fractions'))

    expect(props.onSelect).toHaveBeenCalledWith(CHATS[0])
  })

  it('marks only the open chat as current', () => {
    renderSidebar({ selectedId: 'c2' })

    expect(chatButton('Volcanoes')).toHaveAttribute('aria-current', 'true')
    expect(chatButton('Fractions')).not.toHaveAttribute('aria-current')
  })

  it('keeps pin and delete as separate buttons, not nested inside the chat button', () => {
    const props = renderSidebar()
    const button = chatButton('Fractions')

    expect(button.querySelector('button')).toBeNull()

    const row = button.parentElement
    fireEvent.click(within(row).getByTitle('Delete chat'))

    expect(props.onRemove).toHaveBeenCalledWith('c1')
    expect(props.onSelect).not.toHaveBeenCalled()
  })
})
