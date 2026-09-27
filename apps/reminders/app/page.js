'use client'

import { useEffect, useState } from 'react'
import {
  REMINDERS_STORAGE_KEY,
  createReminderState,
  addReminder,
  removeReminder,
  nextReminderId,
  parseReminderState,
  serializeReminderState,
} from '../src/index.js'

export default function RemindersPage() {
  const [state, setState] = useState(() => createReminderState([]))
  const [draft, setDraft] = useState({ title: '', dueLabel: '' })
  const [loadError, setLoadError] = useState(false)
  const [saveError, setSaveError] = useState(false)

  useEffect(() => {
    try {
      const saved = parseReminderState(window.localStorage.getItem(REMINDERS_STORAGE_KEY))
      setState(saved)
    } catch {
      setLoadError(true)
    }
  }, [])

  function persist(next) {
    try {
      window.localStorage.setItem(REMINDERS_STORAGE_KEY, serializeReminderState(next))
      setSaveError(false)
    } catch {
      setSaveError(true)
    }
  }

  function handleAdd(e) {
    e.preventDefault()
    const title = draft.title.trim()
    if (!title) return
    const next = addReminder(state, {
      id: nextReminderId(state, Date.now()),
      title,
      dueLabel: draft.dueLabel.trim(),
      completed: false,
    })
    setState(next)
    persist(next)
    setDraft({ title: '', dueLabel: '' })
  }

  function toggleReminder(id) {
    const next = {
      ...state,
      items: state.items.map((item) =>
        item.id === id ? { ...item, completed: !item.completed } : item
      ),
    }
    setState(next)
    persist(next)
  }

  function deleteReminder(id) {
    const next = removeReminder(state, id)
    setState(next)
    persist(next)
  }

  return (
    <main className="mx-auto max-w-lg px-4 py-10">
      <h1 className="mb-2 text-3xl font-bold text-slate-800">Reminders</h1>
      <p className="mb-6 text-slate-500">Keep track of chores, school tasks, and routines.</p>

      <form onSubmit={handleAdd} className="mb-6 flex flex-col gap-2 sm:flex-row">
        <label htmlFor="reminder-title" className="sr-only">Reminder</label>
        <input
          id="reminder-title"
          type="text"
          value={draft.title}
          onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
          placeholder="Reminder…"
          className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />
        <label htmlFor="reminder-due" className="sr-only">When (optional)</label>
        <input
          id="reminder-due"
          type="text"
          value={draft.dueLabel}
          onChange={(e) => setDraft((d) => ({ ...d, dueLabel: e.target.value }))}
          placeholder="When (optional)"
          className="w-36 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />
        <button
          type="submit"
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition"
        >
          Add
        </button>
      </form>

      {loadError && (
        <p role="alert" className="mb-2 text-sm text-red-600">Saved reminders could not be loaded.</p>
      )}
      {saveError && (
        <p role="alert" className="mb-2 text-sm text-red-600">Changes could not be saved.</p>
      )}

      {state.items.length === 0 ? (
        <p className="text-sm text-slate-400">No reminders yet.</p>
      ) : (
        <ul className="space-y-2">
          {state.items.map((item) => (
            <li
              key={item.id}
              className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
            >
              <input
                type="checkbox"
                checked={item.completed}
                onChange={() => toggleReminder(item.id)}
                aria-label={item.title}
                className="h-4 w-4 rounded accent-indigo-600"
              />
              <div className="flex-1 min-w-0">
                <p className={`text-sm ${item.completed ? 'line-through text-slate-400' : 'text-slate-700'}`}>
                  {item.title}
                </p>
                {item.dueLabel && (
                  <p className="text-xs text-slate-400">{item.dueLabel}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => deleteReminder(item.id)}
                aria-label={`Delete ${item.title}`}
                className="text-xs text-slate-400 hover:text-red-600"
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
