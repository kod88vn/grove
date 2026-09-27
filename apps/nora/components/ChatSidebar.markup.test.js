import { render, screen, within } from '@testing-library/react'
import { ChatSidebar } from './ChatSidebar'

const NOW = Math.floor(Date.now() / 1000)
const CHATS = [
  { id: 'c1', title: 'Fractions', pinned: false, updated_at: NOW },
  { id: 'c2', title: 'Volcanoes', pinned: true, updated_at: NOW },
]

// Elements that are flow content but not phrasing content, and so are not allowed inside <button>.
const NON_PHRASING = 'p, div, h1, h2, h3, h4, h5, h6, ul, ol, li, section, article, header, footer'

describe('ChatSidebar chat button markup', () => {
  it('only puts phrasing content inside each chat button', () => {
    render(
      <ChatSidebar
        chats={CHATS}
        selectedId={null}
        onSelect={jest.fn()}
        onNew={jest.fn()}
        onPin={jest.fn()}
        onRemove={jest.fn()}
      />,
    )
    const sidebar = within(screen.getByTestId('desktop-sidebar'))

    for (const { title } of CHATS) {
      const button = sidebar.getByRole('button', { name: new RegExp(`^${title}`) })
      expect(button.querySelectorAll(NON_PHRASING)).toHaveLength(0)
      expect(within(button).getByText(title)).toBeInTheDocument()
    }
  })
})
