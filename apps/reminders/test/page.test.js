import { render, screen, fireEvent } from '@testing-library/react'
import RemindersPage from '../app/page.js'

// Mock the functions
jest.mock('../src/index.js', () => ({
  createReminderState: jest.fn(() => ({ appId: 'reminders', items: [] })),
  addReminder: jest.fn((state, reminder) => ({ ...state, items: [...state.items, reminder] })),
}))

describe('RemindersPage', () => {
  it('renders the page', () => {
    render(<RemindersPage />)
    expect(screen.getByText('Reminders')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Reminder…')).toBeInTheDocument()
  })

  it('adds a reminder on form submit', () => {
    render(<RemindersPage />)
    const titleInput = screen.getByPlaceholderText('Reminder…')
    const dueInput = screen.getByPlaceholderText('When (optional)')
    const button = screen.getByRole('button', { name: /add/i })
    fireEvent.change(titleInput, { target: { value: 'Do laundry' } })
    fireEvent.change(dueInput, { target: { value: 'Tomorrow' } })
    fireEvent.click(button)
    expect(require('../src/index.js').addReminder).toHaveBeenCalled()
  })
})