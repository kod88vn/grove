import { render, screen, fireEvent } from '@testing-library/react'
import ShoppingListPage from '../app/page.js'

// Mock the functions
jest.mock('../src/index.js', () => ({
  createShoppingListState: jest.fn(() => ({ appId: 'shopping-list', items: [] })),
  addShoppingItem: jest.fn((state, item) => ({ ...state, items: [...state.items, item] })),
}))

describe('ShoppingListPage', () => {
  it('renders the page', () => {
    render(<ShoppingListPage />)
    expect(screen.getByText('Shopping List')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Add an item…')).toBeInTheDocument()
  })

  it('adds an item on form submit', () => {
    render(<ShoppingListPage />)
    const input = screen.getByPlaceholderText('Add an item…')
    const button = screen.getByRole('button', { name: /add/i })
    fireEvent.change(input, { target: { value: 'Milk' } })
    fireEvent.click(button)
    // Check if item is added, but since state is mocked, perhaps check the mock calls
    expect(require('../src/index.js').addShoppingItem).toHaveBeenCalled()
  })

  // Add more tests for toggling, etc.
})