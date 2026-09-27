import { render, screen, fireEvent } from '@testing-library/react'
import { renderToString } from 'react-dom/server.node'
import RemindersPage from './page.js'
import {
  REMINDERS_STORAGE_KEY,
  createReminderState,
  removeReminder,
  parseReminderState,
  serializeReminderState,
  nextReminderId,
} from '../src/index.js'

// Reminders lived only in React state: a reload wiped the whole list, and
// there was no way to remove a reminder once it had been added.

const save = (items) =>
  window.localStorage.setItem(REMINDERS_STORAGE_KEY, JSON.stringify(items))
const stored = () => JSON.parse(window.localStorage.getItem(REMINDERS_STORAGE_KEY))

function add(title, dueLabel = '') {
  fireEvent.change(screen.getByLabelText('Reminder'), { target: { value: title } })
  fireEvent.change(screen.getByLabelText('When (optional)'), { target: { value: dueLabel } })
  fireEvent.click(screen.getByRole('button', { name: 'Add' }))
}

const WATER = { id: 'r1', title: 'Water plants', dueLabel: 'Sunday', completed: true }

describe('reminder storage helpers', () => {
  it('uses a namespaced storage key', () => {
    expect(REMINDERS_STORAGE_KEY).toBe('grove:reminders')
  })

  it('treats a missing value as an empty list', () => {
    expect(parseReminderState(null)).toEqual(createReminderState([]))
  })

  it('round-trips through serialize and parse', () => {
    const state = createReminderState([WATER])
    expect(parseReminderState(serializeReminderState(state))).toEqual(state)
  })

  it('throws on unreadable data instead of guessing', () => {
    expect(typeof parseReminderState).toBe('function')
    expect(() => parseReminderState('{not json')).toThrow()
    expect(() => parseReminderState('{"items":[]}')).toThrow()
  })

  it('throws when any saved entry is not a reminder object', () => {
    for (const raw of ['["corrupt"]', '[1]', '[null]', '[[]]', '[{"id":"r1","title":"ok"},"x"]']) {
      expect(() => parseReminderState(raw)).toThrow()
    }
  })

  it('picks an id not already in the list', () => {
    expect(nextReminderId(createReminderState([]), 5)).toBe('reminder-5')
    const taken = createReminderState([
      { id: 'reminder-5', title: 'a' },
      { id: 'reminder-5-2', title: 'b' },
    ])
    expect(nextReminderId(taken, 5)).toBe('reminder-5-3')
  })

  it('removes only the reminder with the given id', () => {
    const state = createReminderState([WATER, { id: 'r2', title: 'Feed the cat' }])
    expect(removeReminder(state, 'r1').items.map((r) => r.id)).toEqual(['r2'])
  })
})

describe('RemindersPage persistence', () => {
  it('shows reminders saved by a previous visit', () => {
    save([WATER])
    render(<RemindersPage />)
    expect(screen.getByRole('checkbox', { name: 'Water plants' })).toBeChecked()
    expect(screen.getByText('Sunday')).toBeInTheDocument()
  })

  it('does not write to storage just by opening the page', () => {
    window.localStorage.setItem(REMINDERS_STORAGE_KEY, '[{"id":"r1","title":"Water plants"}]')
    render(<RemindersPage />)
    expect(window.localStorage.getItem(REMINDERS_STORAGE_KEY)).toBe(
      '[{"id":"r1","title":"Water plants"}]'
    )
  })

  it('saves a newly added reminder', () => {
    render(<RemindersPage />)
    add('Do laundry', 'Tonight')
    expect(stored()).toEqual([
      expect.objectContaining({ title: 'Do laundry', dueLabel: 'Tonight', completed: false }),
    ])
  })

  it('saves a completed toggle', () => {
    save([{ ...WATER, completed: false }])
    render(<RemindersPage />)
    fireEvent.click(screen.getByRole('checkbox', { name: 'Water plants' }))
    expect(stored()[0].completed).toBe(true)
  })

  it('keeps reminders across a reload', () => {
    const first = render(<RemindersPage />)
    add('Do laundry')
    first.unmount()
    render(<RemindersPage />)
    expect(screen.getByRole('checkbox', { name: 'Do laundry' })).toBeInTheDocument()
  })

  it('does not read storage during the server render (no hydration mismatch)', () => {
    save([WATER])
    const html = renderToString(<RemindersPage />)
    expect(html).toContain('No reminders yet.')
    expect(html).not.toContain('Water plants')
  })

  it('tells the user when saved reminders cannot be read, and leaves them alone', () => {
    window.localStorage.setItem(REMINDERS_STORAGE_KEY, '{broken')
    render(<RemindersPage />)
    expect(screen.getByRole('alert')).toHaveTextContent('Saved reminders could not be loaded.')
    expect(window.localStorage.getItem(REMINDERS_STORAGE_KEY)).toBe('{broken')
  })

  it('alerts instead of showing a blank row for a corrupt saved entry', () => {
    window.localStorage.setItem(REMINDERS_STORAGE_KEY, '["corrupt"]')
    render(<RemindersPage />)
    expect(screen.getByRole('alert')).toHaveTextContent('Saved reminders could not be loaded.')
    expect(screen.queryByRole('checkbox')).toBeNull()
  })

  it('shows no alert when storage is fine', () => {
    save([WATER])
    render(<RemindersPage />)
    expect(screen.queryByRole('alert')).toBeNull()
  })
})

describe('RemindersPage delete', () => {
  it('deletes one reminder and keeps the rest', () => {
    render(<RemindersPage />)
    add('Do laundry')
    add('Feed the cat')
    fireEvent.click(screen.getByRole('button', { name: 'Delete Do laundry' }))
    expect(screen.queryByRole('checkbox', { name: 'Do laundry' })).toBeNull()
    expect(screen.getByRole('checkbox', { name: 'Feed the cat' })).toBeInTheDocument()
  })

  it('forgets a deleted reminder after a reload', () => {
    save([WATER, { id: 'r2', title: 'Feed the cat', dueLabel: '', completed: false }])
    const first = render(<RemindersPage />)
    fireEvent.click(screen.getByRole('button', { name: 'Delete Water plants' }))
    expect(stored().map((r) => r.title)).toEqual(['Feed the cat'])
    first.unmount()
    render(<RemindersPage />)
    expect(screen.queryByText('Water plants')).toBeNull()
  })

  it('shows the empty state after the last reminder is deleted', () => {
    render(<RemindersPage />)
    add('Do laundry')
    fireEvent.click(screen.getByRole('button', { name: 'Delete Do laundry' }))
    expect(screen.getByText('No reminders yet.')).toBeInTheDocument()
  })

  it('gives reminders added in the same instant distinct ids', () => {
    const now = jest.spyOn(Date, 'now').mockReturnValue(1700000000000)
    try {
      render(<RemindersPage />)
      add('Do laundry')
      add('Feed the cat')
    } finally {
      now.mockRestore()
    }
    const ids = stored().map((r) => r.id)
    expect(new Set(ids).size).toBe(2)
  })

  it('keeps ids distinct without relying on randomness', () => {
    const now = jest.spyOn(Date, 'now').mockReturnValue(1700000000000)
    const rand = jest.spyOn(Math, 'random').mockReturnValue(0.5)
    try {
      render(<RemindersPage />)
      add('Do laundry')
      add('Feed the cat')
      fireEvent.click(screen.getByRole('button', { name: 'Delete Do laundry' }))
    } finally {
      now.mockRestore()
      rand.mockRestore()
    }
    expect(stored().map((r) => r.title)).toEqual(['Feed the cat'])
  })
})
