'use client'

import { useState } from 'react'
import { createReminderState, addReminder } from '../src/index.js'

export default function RemindersPage() {
  const [state, setState] = useState(() => createReminderState([]))
  const [draft, setDraft] = useState({ title: '', dueLabel: '' })

  function handleAdd(e) {
    e.preventDefault()
    const title = draft.title.trim()
    if (!title) return
    setState((prev) =>
      addReminder(prev, {
        id: `reminder-${Date.now()}`,
        title,
        dueLabel: draft.dueLabel.trim(),
        completed: false,
      })
    )
    setDraft({ title: '', dueLabel: '' })
  }

  function toggleReminder(id) {
    setState((prev) => ({
      ...prev,
      items: prev.items.map((item) =>
        item.id === id ? { ...item, completed: !item.completed } : item
      ),
    }))
  }

  return (
    <main className="mx-auto max-w-lg px-4 py-10">
      <h1 className="mb-2 text-3xl font-bold text-slate-800">Reminders</h1>
      <p className="mb-6 text-slate-500">Keep track of chores, school tasks, and routines.</p>

      <form onSubmit={handleAdd} className="mb-6 flex flex-col gap-2 sm:flex-row">
        <input
          type="text"
          value={draft.title}
          onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
          placeholder="Reminder…"
          className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />
        <input
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
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
