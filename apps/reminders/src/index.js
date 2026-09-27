export const REMINDERS_APP = {
  id: 'reminders',
  name: 'Reminders',
  zone: 'reminders',
  summary: 'Simple recurring reminders for chores, school, and routines.',
}

export const REMINDERS_STORAGE_KEY = 'grove:reminders'

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

export function removeReminder(state, id) {
  return createReminderState(state.items.filter((item) => item.id !== id))
}

export function serializeReminderState(state) {
  return JSON.stringify(state.items)
}

export function parseReminderState(raw) {
  if (raw === null) return createReminderState([])

  const parsed = JSON.parse(raw)
  if (!Array.isArray(parsed)) throw new Error('Saved reminders must be an array')
  if (parsed.some((item) => item === null || typeof item !== 'object' || Array.isArray(item))) {
    throw new Error('Saved reminders must contain objects')
  }
  if (parsed.some((item) =>
    typeof item.id !== 'string' ||
    typeof item.title !== 'string' ||
    item.id.trim() === '' ||
    item.title.trim() === ''
  )) {
    throw new Error('Saved reminders must contain an id and title')
  }
  const ids = parsed.map((item) => item.id)
  if (new Set(ids).size !== ids.length) {
    throw new Error('Saved reminders must contain unique ids')
  }
  return createReminderState(parsed)
}

export function nextReminderId(state, now) {
  const base = `reminder-${now}`
  const usedIds = new Set(state.items.map((item) => item.id))
  if (!usedIds.has(base)) return base

  let suffix = 2
  while (usedIds.has(`${base}-${suffix}`)) suffix += 1
  return `${base}-${suffix}`
}
