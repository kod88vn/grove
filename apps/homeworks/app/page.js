'use client'

import { useState } from 'react'

export default function HomeworksPage() {
  const [homeworks, setHomeworks] = useState([])
  const [draft, setDraft] = useState('')

  function handleAdd(e) {
    e.preventDefault()
    const title = draft.trim()
    if (!title) return
    setHomeworks((prev) => [
      ...prev,
      {
        id: `hw-${Date.now()}`,
        title,
        completed: false,
      },
    ])
    setDraft('')
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-6 text-3xl font-bold text-slate-900">Homeworks</h1>
      <form onSubmit={handleAdd} className="mb-6 flex gap-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Add a new homework..."
          className="flex-1 rounded border border-slate-300 px-4 py-2"
        />
        <button
          type="submit"
          className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
        >
          Add
        </button>
      </form>
      <div className="space-y-2">
        {homeworks.length === 0 ? (
          <p className="text-slate-500">No homeworks yet.</p>
        ) : (
          homeworks.map((hw) => (
            <div
              key={hw.id}
              className="flex items-center gap-3 rounded border border-slate-200 p-3 bg-white"
            >
              <input
                type="checkbox"
                checked={hw.completed}
                onChange={(e) =>
                  setHomeworks((prev) =>
                    prev.map((h) =>
                      h.id === hw.id ? { ...h, completed: e.target.checked } : h
                    )
                  )
                }
                className="h-4 w-4"
              />
              <span className={hw.completed ? 'line-through text-slate-400' : ''}>
                {hw.title}
              </span>
            </div>
          ))
        )}
      </div>
    </main>
  )
}
