export const SHOPPING_LIST_APP = {
  id: 'shopping-list',
  name: 'Shopping List',
  zone: 'shopping-list',
  summary: 'Shared grocery planning with family-friendly quick add flows.',
}

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