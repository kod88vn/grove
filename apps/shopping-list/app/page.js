'use client'

import { useEffect, useState } from 'react'
import {
  SHOPPING_LIST_STORAGE_KEY,
  createShoppingListState,
  addShoppingItem,
  removeShoppingItem,
  nextShoppingItemId,
  parseShoppingListState,
  serializeShoppingListState,
} from '../src/index.js'

export default function ShoppingListPage() {
  const [state, setState] = useState(() => createShoppingListState([]))
  const [draft, setDraft] = useState('')
  const [loadError, setLoadError] = useState(false)
  const [saveError, setSaveError] = useState(false)

  useEffect(() => {
    try {
      const saved = parseShoppingListState(window.localStorage.getItem(SHOPPING_LIST_STORAGE_KEY))
      setState(saved)
    } catch {
      setLoadError(true)
    }
  }, [])

  function persist(next) {
    try {
      window.localStorage.setItem(SHOPPING_LIST_STORAGE_KEY, serializeShoppingListState(next))
      setSaveError(false)
    } catch {
      setSaveError(true)
    }
  }

  function handleAdd(e) {
    e.preventDefault()
    const label = draft.trim()
    if (!label) return
    const next = addShoppingItem(state, {
      id: nextShoppingItemId(state, Date.now()),
      label,
      checked: false,
      note: '',
    })
    setState(next)
    persist(next)
    setDraft('')
  }

  function toggleItem(id) {
    const next = {
      ...state,
      items: state.items.map((item) =>
        item.id === id ? { ...item, checked: !item.checked } : item
      ),
    }
    setState(next)
    persist(next)
  }

  function deleteItem(id) {
    const next = removeShoppingItem(state, id)
    setState(next)
    persist(next)
  }

  return (
    <main className="mx-auto max-w-lg px-4 py-10">
      <h1 className="mb-2 text-3xl font-bold text-slate-800">Shopping List</h1>
      <p className="mb-6 text-slate-500">Add items and check them off as you shop.</p>

      <form onSubmit={handleAdd} className="mb-6 flex gap-2">
        <label htmlFor="shopping-new-item" className="sr-only">New item</label>
        <input
          id="shopping-new-item"
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

      {loadError && (
        <p role="alert" className="mb-2 text-sm text-red-600">Saved items could not be loaded.</p>
      )}
      {saveError && (
        <p role="alert" className="mb-2 text-sm text-red-600">Changes could not be saved.</p>
      )}

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
                aria-label={item.label}
                className="h-4 w-4 rounded accent-indigo-600"
              />
              <span className={`text-sm ${item.checked ? 'line-through text-slate-400' : 'text-slate-700'}`}>
                {item.label}
              </span>
              <button
                type="button"
                onClick={() => deleteItem(item.id)}
                aria-label={`Delete ${item.label}`}
                className="ml-auto text-xs text-slate-400 hover:text-red-600"
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
