import { render, screen, fireEvent } from '@testing-library/react'
import RemindersPage from './page.js'

// The add-reminder inputs were named only by their placeholders (which vanish
// as soon as you type), and every reminder's checkbox had no name at all, so a
// screen reader heard "checkbox, not checked" for each row.

function addReminder(title) {
  fireEvent.change(screen.getByLabelText('Reminder'), { target: { value: title } })
  fireEvent.click(screen.getByRole('button', { name: 'Add' }))
}

describe('RemindersPage accessible names', () => {
  it('labels the reminder title input', () => {
    render(<RemindersPage />)
    expect(screen.getByLabelText('Reminder')).toBe(screen.getByPlaceholderText('Reminder…'))
  })

  it('labels the optional due input', () => {
    render(<RemindersPage />)
    expect(screen.getByLabelText('When (optional)')).toBe(screen.getByPlaceholderText('When (optional)'))
  })

  it('names each reminder checkbox after its reminder', () => {
    render(<RemindersPage />)
    addReminder('Do laundry')
    const checkbox = screen.getByRole('checkbox', { name: 'Do laundry' })
    expect(checkbox).not.toBeChecked()
    fireEvent.click(checkbox)
    expect(screen.getByRole('checkbox', { name: 'Do laundry' })).toBeChecked()
  })

  it('gives every reminder checkbox a distinct name', () => {
    render(<RemindersPage />)
    addReminder('Do laundry')
    addReminder('Feed the cat')
    expect(screen.getByRole('checkbox', { name: 'Do laundry' })).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Feed the cat' })).toBeInTheDocument()
  })
})
