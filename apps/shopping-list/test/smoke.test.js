import { SHOPPING_LIST_APP, addShoppingItem, createShoppingListState } from '../src/index.js'

describe('shopping-list smoke', () => {
  it('workspace exposes app metadata', () => {
    expect(SHOPPING_LIST_APP.id).toBe('shopping-list')
    expect(SHOPPING_LIST_APP.zone).toBe('shopping-list')
  })

  it('state helpers normalize added items', () => {
    const state = createShoppingListState([])
    const item = { id: 'item-1', label: 'Milk', checked: false, note: '' }
    const newState = addShoppingItem(state, item)
    expect(newState.items).toEqual([item])
  })
})