import { REMINDERS_APP, addReminder, createReminderState } from './index.js'

describe('reminders smoke', () => {
  it('workspace exposes app metadata', () => {
    expect(REMINDERS_APP.id).toBe('reminders')
    expect(REMINDERS_APP.zone).toBe('reminders')
  })

  it('state helpers normalize added items', () => {
    const state = createReminderState([])
    const item = { id: 'reminder-1', title: 'Do homework', dueLabel: '', completed: false }
    const newState = addReminder(state, item)
    expect(newState.items).toEqual([item])
  })
})