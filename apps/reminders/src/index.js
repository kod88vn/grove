export const REMINDERS_APP = {
  id: 'reminders',
  name: 'Reminders',
  zone: 'reminders',
  summary: 'Simple recurring reminders for chores, school, and routines.',
}

export function createReminderState(items = []) {
  return {
    appId: REMINDERS_APP.id,
    items: items.map((item, index) => ({
      id: item.id || `reminder-${index + 1}`,
      title: item.title || '',
      dueLabel: item.dueLabel || '',
      completed: Boolean(item.completed),
    })),
  }
}

export function addReminder(state, reminder) {
  return createReminderState([
    ...state.items,
    {
      id: reminder.id,
      title: reminder.title,
      dueLabel: reminder.dueLabel,
      completed: reminder.completed,
    },
  ])
}