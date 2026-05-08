import { createReminderState, addReminder, REMINDERS_APP } from '../src/index.js'

describe('reminders', () => {
  describe('REMINDERS_APP', () => {
    it('has correct properties', () => {
      expect(REMINDERS_APP).toEqual({
        id: 'reminders',
        name: 'Reminders',
        zone: 'reminders',
        summary: 'Simple recurring reminders for chores, school, and routines.',
      })
    })
  })

  describe('createReminderState', () => {
    it('creates state with default items', () => {
      const state = createReminderState()
      expect(state).toEqual({
        appId: 'reminders',
        items: [],
      })
    })

    it('creates state with provided items', () => {
      const items = [{ id: '1', title: 'Do homework', dueLabel: 'Tomorrow', completed: false }]
      const state = createReminderState(items)
      expect(state).toEqual({
        appId: 'reminders',
        items: [{ id: '1', title: 'Do homework', dueLabel: 'Tomorrow', completed: false }],
      })
    })
  })

  describe('addReminder', () => {
    it('adds reminder to state', () => {
      const state = createReminderState()
      const newReminder = { id: '1', title: 'Walk dog', dueLabel: 'Evening', completed: false }
      const newState = addReminder(state, newReminder)
      expect(newState.items).toHaveLength(1)
      expect(newState.items[0]).toEqual(newReminder)
    })
  })
})