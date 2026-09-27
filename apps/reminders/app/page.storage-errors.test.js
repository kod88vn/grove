import { render, screen, fireEvent } from '@testing-library/react'
import RemindersPage from './page.js'
import { REMINDERS_STORAGE_KEY, parseReminderState } from '../src/index.js'

// PR #73 review follow-up:
//  - a saved entry that is an object but not a reminder ({"foo":1}) rendered
//    as a blank row instead of the load alert;
//  - when the browser refuses to store (quota, blocked site data) setItem
//    threw out of the click handler and the user was never told their
//    change was not saved.

const storageProto = () => Object.getPrototypeOf(window.localStorage)

function add(title) {
  fireEvent.change(screen.getByLabelText('Reminder'), { target: { value: title } })
  fireEvent.click(screen.getByRole('button', { name: 'Add' }))
}

function refuseWrites() {
  return jest.spyOn(storageProto(), 'setItem').mockImplementation(() => {
    throw new DOMException('The quota has been exceeded.', 'QuotaExceededError')
  })
}

afterEach(() => jest.restoreAllMocks())

describe('parseReminderState entry shape', () => {
  it('rejects entries without a string id and a string title', () => {
    for (const raw of [
      '[{"foo":1}]',
      '[{"id":"r1"}]',
      '[{"title":"Water plants"}]',
      '[{"id":1,"title":"Water plants"}]',
      '[{"id":"r1","title":null}]',
    ]) {
      expect(() => parseReminderState(raw)).toThrow()
    }
  })

  // PR #75 review: an empty id is silently regenerated and an empty title
  // renders a blank row. The add form never saves either, so both are corrupt.
  it('rejects entries whose id or title is empty or only whitespace', () => {
    for (const raw of [
      '[{"id":"","title":""}]',
      '[{"id":"","title":"Water plants"}]',
      '[{"id":"r1","title":""}]',
      '[{"id":"r1","title":"   "}]',
      '[{"id":"  ","title":"Water plants"}]',
    ]) {
      expect(() => parseReminderState(raw)).toThrow()
    }
  })

  it('alerts instead of showing a blank row for a reminder with an empty title', () => {
    window.localStorage.setItem(REMINDERS_STORAGE_KEY, '[{"id":"r1","title":""}]')
    render(<RemindersPage />)
    expect(screen.getByRole('alert')).toHaveTextContent('Saved reminders could not be loaded.')
    expect(screen.queryByRole('checkbox')).toBeNull()
  })

  it('still accepts entries with only an id and a title', () => {
    expect(parseReminderState('[{"id":"r1","title":"Water plants"}]').items).toEqual([
      { id: 'r1', title: 'Water plants', dueLabel: '', completed: false },
    ])
  })
})

describe('RemindersPage storage errors', () => {
  it('alerts instead of showing a blank row for an object that is not a reminder', () => {
    window.localStorage.setItem(REMINDERS_STORAGE_KEY, '[{"foo":1}]')
    render(<RemindersPage />)
    expect(screen.getByRole('alert')).toHaveTextContent('Saved reminders could not be loaded.')
    expect(screen.queryByRole('checkbox')).toBeNull()
  })

  it('alerts when storage cannot be read at all', () => {
    jest.spyOn(storageProto(), 'getItem').mockImplementation(() => {
      throw new DOMException('Access denied.', 'SecurityError')
    })
    render(<RemindersPage />)
    expect(screen.getByRole('alert')).toHaveTextContent('Saved reminders could not be loaded.')
  })

  it('keeps an added reminder on screen and says it was not saved', () => {
    render(<RemindersPage />)
    refuseWrites()
    expect(() => add('Do laundry')).not.toThrow()
    expect(screen.getByRole('checkbox', { name: 'Do laundry' })).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('Changes could not be saved.')
  })

  it('says a toggle was not saved', () => {
    render(<RemindersPage />)
    add('Do laundry')
    refuseWrites()
    fireEvent.click(screen.getByRole('checkbox', { name: 'Do laundry' }))
    expect(screen.getByRole('checkbox', { name: 'Do laundry' })).toBeChecked()
    expect(screen.getByRole('alert')).toHaveTextContent('Changes could not be saved.')
  })

  it('says a delete was not saved', () => {
    render(<RemindersPage />)
    add('Do laundry')
    refuseWrites()
    fireEvent.click(screen.getByRole('button', { name: 'Delete Do laundry' }))
    expect(screen.queryByRole('checkbox', { name: 'Do laundry' })).toBeNull()
    expect(screen.getByRole('alert')).toHaveTextContent('Changes could not be saved.')
  })

  it('clears the save alert once a later save succeeds', () => {
    render(<RemindersPage />)
    const refused = refuseWrites()
    add('Do laundry')
    expect(screen.getByRole('alert')).toHaveTextContent('Changes could not be saved.')
    refused.mockRestore()
    add('Feed the cat')
    expect(screen.queryByRole('alert')).toBeNull()
    expect(JSON.parse(window.localStorage.getItem(REMINDERS_STORAGE_KEY)).map((r) => r.title)).toEqual([
      'Do laundry',
      'Feed the cat',
    ])
  })
})
