'use client'

import { useState } from 'react'
import { createShoppingListState, addShoppingItem } from '../src/index.js'

export default function ShoppingListPage() {
  const [state, setState] = useState(() => createShoppingListState([]))
  const [draft, setDraft] = useState('')

  function handleAdd(e) {
    e.preventDefault()
    const label = draft.trim()
    if (!label) return
    setState((prev) =>
      addShoppingItem(prev, {
        id: `item-${Date.now()}`,
        label,
        checked: false,
        note: '',
      })
    )
    setDraft('')
  }

  function toggleItem(id) {
    setState((prev) => ({
      ...prev,
      items: prev.items.map((item) =>
        item.id === id ? { ...item, checked: !item.checked } : item
      ),
    }))
  }

  return (
    <main className="mx-auto max-w-lg px-4 py-10">
      <h1 className="mb-2 text-3xl font-bold text-slate-800">Shopping List</h1>
      <p className="mb-6 text-slate-500">Add items and check them off as you shop.</p>

      <form onSubmit={handleAdd} className="mb-6 flex gap-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Add an item…"
          className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />
        <button
          type="submit"
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition"
        >
          Add
        </button>
      </form>

      {state.items.length === 0 ? (
        <p className="text-sm text-slate-400">No items yet.</p>
      ) : (
        <ul className="space-y-2">
          {state.items.map((item) => (
            <li
              key={item.id}
              className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
            >
              <input
                type="checkbox"
                checked={item.checked}
                onChange={() => toggleItem(item.id)}
                className="h-4 w-4 rounded accent-indigo-600"
              />
              <span className={`text-sm ${item.checked ? 'line-through text-slate-400' : 'text-slate-700'}`}>
                {item.label}
              </span>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
