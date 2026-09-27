import { render, screen, fireEvent } from '@testing-library/react'
import ShoppingListPage from './page.js'

// The add-item input was named only by its placeholder (which vanishes as
// soon as you type), and every item's checkbox had no name at all, so a
// screen reader heard "checkbox, not checked" for each row.

function addItem(label) {
  fireEvent.change(screen.getByLabelText('New item'), { target: { value: label } })
  fireEvent.click(screen.getByRole('button', { name: 'Add' }))
}

describe('ShoppingListPage accessible names', () => {
  it('labels the add-item input', () => {
    render(<ShoppingListPage />)
    expect(screen.getByLabelText('New item')).toBe(screen.getByPlaceholderText('Add an item…'))
  })

  it('names each item checkbox after its item', () => {
    render(<ShoppingListPage />)
    addItem('Milk')
    const checkbox = screen.getByRole('checkbox', { name: 'Milk' })
    expect(checkbox).not.toBeChecked()
    fireEvent.click(checkbox)
    expect(screen.getByRole('checkbox', { name: 'Milk' })).toBeChecked()
  })

  it('gives every item checkbox a distinct name', () => {
    render(<ShoppingListPage />)
    addItem('Milk')
    addItem('Bread')
    expect(screen.getByRole('checkbox', { name: 'Milk' })).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Bread' })).toBeInTheDocument()
  })
})
