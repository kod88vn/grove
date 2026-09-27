export const SHOPPING_LIST_APP = {
  id: 'shopping-list',
  name: 'Shopping List',
  zone: 'shopping-list',
  summary: 'Shared grocery planning with family-friendly quick add flows.',
}

export const SHOPPING_LIST_STORAGE_KEY = 'grove:shopping-list'

export function createShoppingListState(items = []) {
  return {
    appId: SHOPPING_LIST_APP.id,
    items: items.map((item, index) => ({
      id: item.id || `item-${index + 1}`,
      label: item.label || '',
      checked: Boolean(item.checked),
      note: item.note || '',
    })),
  }
}

export function addShoppingItem(state, item) {
  return createShoppingListState([
    ...state.items,
    {
      id: item.id,
      label: item.label,
      checked: item.checked,
      note: item.note,
    },
  ])
}

export function removeShoppingItem(state, id) {
  return createShoppingListState(state.items.filter((item) => item.id !== id))
}

export function serializeShoppingListState(state) {
  return JSON.stringify(state.items)
}

export function parseShoppingListState(raw) {
  if (raw === null) return createShoppingListState([])

  const parsed = JSON.parse(raw)
  if (!Array.isArray(parsed)) throw new Error('Saved shopping items must be an array')
  if (parsed.some((item) => item === null || typeof item !== 'object' || Array.isArray(item))) {
    throw new Error('Saved shopping items must contain objects')
  }
  if (parsed.some((item) =>
    typeof item.id !== 'string' ||
    typeof item.label !== 'string' ||
    item.id.trim() === '' ||
    item.label.trim() === ''
  )) {
    throw new Error('Saved shopping items must contain an id and label')
  }
  return createShoppingListState(parsed)
}

export function nextShoppingItemId(state, now) {
  const base = `item-${now}`
  const usedIds = new Set(state.items.map((item) => item.id))
  if (!usedIds.has(base)) return base

  let suffix = 2
  while (usedIds.has(`${base}-${suffix}`)) suffix += 1
  return `${base}-${suffix}`
}
