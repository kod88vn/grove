import { render, screen, within } from '@testing-library/react'
import { ChatSidebar } from './ChatSidebar'

const NOW = Math.floor(Date.now() / 1000)
const CHATS = [
  { id: 'c1', title: 'Fractions', pinned: false, updated_at: NOW },
  { id: 'c2', title: 'Volcanoes', pinned: true, updated_at: NOW },
]

function renderSidebar() {
  render(
    <ChatSidebar
      chats={CHATS}
      selectedId="c1"
      onSelect={jest.fn()}
      onNew={jest.fn()}
      onPin={jest.fn()}
      onRemove={jest.fn()}
      isMobileOpen
      onClose={jest.fn()}
    />,
  )
}

function classesOf(el) {
  return el.className.split(/\s+/).filter(Boolean)
}

const regions = ['mobile-sidebar-overlay', 'desktop-sidebar']

describe('ChatSidebar row actions visibility', () => {
  it.each(regions)('does not hide pin/delete unconditionally in %s (touch has no hover)', (testId) => {
    renderSidebar()
    const region = within(screen.getByTestId(testId))
    for (const deleteButton of region.getAllByTitle('Delete chat')) {
      const actions = deleteButton.parentElement
      expect(classesOf(actions)).not.toContain('opacity-0')
    }
  })

  it.each(regions)('reveals pin/delete when the row has keyboard focus in %s', (testId) => {
    renderSidebar()
    const region = within(screen.getByTestId(testId))
    for (const deleteButton of region.getAllByTitle('Delete chat')) {
      const actions = deleteButton.parentElement
      expect(classesOf(actions)).toContain('group-focus-within:opacity-100')
    }
  })

  it('does not show a pointer cursor on the row outside the clickable chat button', () => {
    renderSidebar()
    const region = within(screen.getByTestId('desktop-sidebar'))
    for (const { title } of CHATS) {
      const row = region.getByRole('button', { name: new RegExp(`^${title}`) }).parentElement
      expect(classesOf(row)).not.toContain('cursor-pointer')
    }
  })
})
