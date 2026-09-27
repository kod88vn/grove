import { render, screen, fireEvent } from '@testing-library/react'
import { renderToString } from 'react-dom/server.node'
import ShoppingListPage from './page.js'
import {
  SHOPPING_LIST_STORAGE_KEY,
  createShoppingListState,
  removeShoppingItem,
  parseShoppingListState,
  serializeShoppingListState,
  nextShoppingItemId,
} from '../src/index.js'

// The shopping list lived only in React state: a reload wiped every item, and
// there was no way to remove an item once it had been added.

const save = (items) =>
  window.localStorage.setItem(SHOPPING_LIST_STORAGE_KEY, JSON.stringify(items))
const stored = () => JSON.parse(window.localStorage.getItem(SHOPPING_LIST_STORAGE_KEY))
const storageProto = () => Object.getPrototypeOf(window.localStorage)

function add(label) {
  fireEvent.change(screen.getByLabelText('New item'), { target: { value: label } })
  fireEvent.click(screen.getByRole('button', { name: 'Add' }))
}

function refuseWrites() {
  return jest.spyOn(storageProto(), 'setItem').mockImplementation(() => {
    throw new DOMException('The quota has been exceeded.', 'QuotaExceededError')
  })
}

const MILK = { id: 'i1', label: 'Milk', checked: true, note: '2 litres' }

afterEach(() => jest.restoreAllMocks())

describe('shopping list storage helpers', () => {
  it('uses a namespaced storage key', () => {
    expect(SHOPPING_LIST_STORAGE_KEY).toBe('grove:shopping-list')
  })

  it('treats a missing value as an empty list', () => {
    expect(parseShoppingListState(null)).toEqual(createShoppingListState([]))
  })

  it('round-trips through serialize and parse', () => {
    const state = createShoppingListState([MILK])
    expect(parseShoppingListState(serializeShoppingListState(state))).toEqual(state)
  })

  it('still accepts entries with only an id and a label', () => {
    expect(parseShoppingListState('[{"id":"i1","label":"Milk"}]').items).toEqual([
      { id: 'i1', label: 'Milk', checked: false, note: '' },
    ])
  })

  it('throws on unreadable data instead of guessing', () => {
    expect(() => parseShoppingListState('{not json')).toThrow()
    expect(() => parseShoppingListState('{"items":[]}')).toThrow()
  })

  it('throws when any saved entry is not an item object', () => {
    for (const raw of ['["corrupt"]', '[1]', '[null]', '[[]]', '[{"id":"i1","label":"ok"},"x"]']) {
      expect(() => parseShoppingListState(raw)).toThrow()
    }
  })

  it('throws when an entry lacks a non-blank string id and label', () => {
    for (const raw of [
      '[{"foo":1}]',
      '[{"id":"i1"}]',
      '[{"label":"Milk"}]',
      '[{"id":1,"label":"Milk"}]',
      '[{"id":"i1","label":null}]',
      '[{"id":"","label":"Milk"}]',
      '[{"id":"i1","label":""}]',
      '[{"id":"i1","label":"   "}]',
      '[{"id":"  ","label":"Milk"}]',
    ]) {
      expect(() => parseShoppingListState(raw)).toThrow()
    }
  })

  // PR #77 review: two saved items sharing an id render duplicate React keys
  // and toggle/delete together, because both handlers match by id.
  it('throws when two saved entries share an id', () => {
    expect(() =>
      parseShoppingListState('[{"id":"i1","label":"Milk"},{"id":"i1","label":"Bread"}]')
    ).toThrow()
  })

  it('picks an id not already in the list', () => {
    expect(nextShoppingItemId(createShoppingListState([]), 5)).toBe('item-5')
    const taken = createShoppingListState([
      { id: 'item-5', label: 'a' },
      { id: 'item-5-2', label: 'b' },
    ])
    expect(nextShoppingItemId(taken, 5)).toBe('item-5-3')
  })

  it('removes only the item with the given id', () => {
    const state = createShoppingListState([MILK, { id: 'i2', label: 'Bread' }])
    expect(removeShoppingItem(state, 'i1').items.map((i) => i.id)).toEqual(['i2'])
  })
})

describe('ShoppingListPage persistence', () => {
  it('shows items saved by a previous visit', () => {
    save([MILK])
    render(<ShoppingListPage />)
    expect(screen.getByRole('checkbox', { name: 'Milk' })).toBeChecked()
  })

  it('does not write to storage just by opening the page', () => {
    window.localStorage.setItem(SHOPPING_LIST_STORAGE_KEY, '[{"id":"i1","label":"Milk"}]')
    render(<ShoppingListPage />)
    expect(window.localStorage.getItem(SHOPPING_LIST_STORAGE_KEY)).toBe('[{"id":"i1","label":"Milk"}]')
  })

  it('saves a newly added item', () => {
    render(<ShoppingListPage />)
    add('Eggs')
    expect(stored()).toEqual([expect.objectContaining({ label: 'Eggs', checked: false })])
  })

  it('saves a checked toggle', () => {
    save([{ ...MILK, checked: false }])
    render(<ShoppingListPage />)
    fireEvent.click(screen.getByRole('checkbox', { name: 'Milk' }))
    expect(stored()[0].checked).toBe(true)
  })

  it('keeps the note of a saved item when it is toggled', () => {
    save([MILK])
    render(<ShoppingListPage />)
    fireEvent.click(screen.getByRole('checkbox', { name: 'Milk' }))
    expect(stored()[0]).toEqual({ ...MILK, checked: false })
  })

  it('keeps items across a reload', () => {
    const first = render(<ShoppingListPage />)
    add('Eggs')
    first.unmount()
    render(<ShoppingListPage />)
    expect(screen.getByRole('checkbox', { name: 'Eggs' })).toBeInTheDocument()
  })

  it('does not read storage during the server render (no hydration mismatch)', () => {
    save([MILK])
    const html = renderToString(<ShoppingListPage />)
    expect(html).toContain('No items yet.')
    expect(html).not.toContain('Milk')
  })

  it('shows no alert when storage is fine', () => {
    save([MILK])
    render(<ShoppingListPage />)
    expect(screen.queryByRole('alert')).toBeNull()
  })
})

describe('ShoppingListPage load errors', () => {
  it('tells the user when saved items cannot be read, and leaves them alone', () => {
    window.localStorage.setItem(SHOPPING_LIST_STORAGE_KEY, '{broken')
    render(<ShoppingListPage />)
    expect(screen.getByRole('alert')).toHaveTextContent('Saved items could not be loaded.')
    expect(window.localStorage.getItem(SHOPPING_LIST_STORAGE_KEY)).toBe('{broken')
  })

  it('alerts instead of showing a blank row for a corrupt saved entry', () => {
    for (const raw of [
      '["corrupt"]',
      '[{"foo":1}]',
      '[{"id":"i1","label":""}]',
      '[{"id":"i1","label":"Milk"},{"id":"i1","label":"Bread"}]',
    ]) {
      window.localStorage.setItem(SHOPPING_LIST_STORAGE_KEY, raw)
      const view = render(<ShoppingListPage />)
      expect(screen.getByRole('alert')).toHaveTextContent('Saved items could not be loaded.')
      expect(screen.queryByRole('checkbox')).toBeNull()
      view.unmount()
    }
  })

  it('alerts when storage cannot be read at all', () => {
    jest.spyOn(storageProto(), 'getItem').mockImplementation(() => {
      throw new DOMException('Access denied.', 'SecurityError')
    })
    render(<ShoppingListPage />)
    expect(screen.getByRole('alert')).toHaveTextContent('Saved items could not be loaded.')
  })
})

describe('ShoppingListPage save errors', () => {
  it('keeps an added item on screen and says it was not saved', () => {
    render(<ShoppingListPage />)
    refuseWrites()
    expect(() => add('Eggs')).not.toThrow()
    expect(screen.getByRole('checkbox', { name: 'Eggs' })).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('Changes could not be saved.')
  })

  it('says a toggle was not saved', () => {
    render(<ShoppingListPage />)
    add('Eggs')
    refuseWrites()
    fireEvent.click(screen.getByRole('checkbox', { name: 'Eggs' }))
    expect(screen.getByRole('checkbox', { name: 'Eggs' })).toBeChecked()
    expect(screen.getByRole('alert')).toHaveTextContent('Changes could not be saved.')
  })

  it('says a delete was not saved', () => {
    render(<ShoppingListPage />)
    add('Eggs')
    refuseWrites()
    fireEvent.click(screen.getByRole('button', { name: 'Delete Eggs' }))
    expect(screen.queryByRole('checkbox', { name: 'Eggs' })).toBeNull()
    expect(screen.getByRole('alert')).toHaveTextContent('Changes could not be saved.')
  })

  it('clears the save alert once a later save succeeds', () => {
    render(<ShoppingListPage />)
    const refused = refuseWrites()
    add('Eggs')
    expect(screen.getByRole('alert')).toHaveTextContent('Changes could not be saved.')
    refused.mockRestore()
    add('Bread')
    expect(screen.queryByRole('alert')).toBeNull()
    expect(stored().map((i) => i.label)).toEqual(['Eggs', 'Bread'])
  })
})

describe('ShoppingListPage delete', () => {
  it('deletes one item and keeps the rest', () => {
    render(<ShoppingListPage />)
    add('Eggs')
    add('Bread')
    fireEvent.click(screen.getByRole('button', { name: 'Delete Eggs' }))
    expect(screen.queryByRole('checkbox', { name: 'Eggs' })).toBeNull()
    expect(screen.getByRole('checkbox', { name: 'Bread' })).toBeInTheDocument()
  })

  it('forgets a deleted item after a reload', () => {
    save([MILK, { id: 'i2', label: 'Bread', checked: false, note: '' }])
    const first = render(<ShoppingListPage />)
    fireEvent.click(screen.getByRole('button', { name: 'Delete Milk' }))
    expect(stored().map((i) => i.label)).toEqual(['Bread'])
    first.unmount()
    render(<ShoppingListPage />)
    expect(screen.queryByText('Milk')).toBeNull()
  })

  it('shows the empty state after the last item is deleted', () => {
    render(<ShoppingListPage />)
    add('Eggs')
    fireEvent.click(screen.getByRole('button', { name: 'Delete Eggs' }))
    expect(screen.getByText('No items yet.')).toBeInTheDocument()
  })

  it('gives items added in the same instant distinct ids', () => {
    const now = jest.spyOn(Date, 'now').mockReturnValue(1700000000000)
    const rand = jest.spyOn(Math, 'random').mockReturnValue(0.5)
    render(<ShoppingListPage />)
    add('Eggs')
    add('Bread')
    now.mockRestore()
    rand.mockRestore()
    expect(new Set(stored().map((i) => i.id)).size).toBe(2)
    fireEvent.click(screen.getByRole('button', { name: 'Delete Eggs' }))
    expect(stored().map((i) => i.label)).toEqual(['Bread'])
  })
})
