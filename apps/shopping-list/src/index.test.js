import { createShoppingListState, addShoppingItem, SHOPPING_LIST_APP } from './index.js'

describe('shopping-list', () => {
  describe('SHOPPING_LIST_APP', () => {
    it('has correct properties', () => {
      expect(SHOPPING_LIST_APP).toEqual({
        id: 'shopping-list',
        name: 'Shopping List',
        zone: 'shopping-list',
        summary: 'Shared grocery planning with family-friendly quick add flows.',
      })
    })
  })

  describe('createShoppingListState', () => {
    it('creates state with default items', () => {
      const state = createShoppingListState()
      expect(state).toEqual({
        appId: 'shopping-list',
        items: [],
      })
    })

    it('creates state with provided items', () => {
      const items = [{ id: '1', label: 'Milk', checked: false, note: '' }]
      const state = createShoppingListState(items)
      expect(state).toEqual({
        appId: 'shopping-list',
        items: [{ id: '1', label: 'Milk', checked: false, note: '' }],
      })
    })
  })

  describe('addShoppingItem', () => {
    it('adds item to state', () => {
      const state = createShoppingListState()
      const newItem = { id: '1', label: 'Bread', checked: false, note: 'Whole wheat' }
      const newState = addShoppingItem(state, newItem)
      expect(newState.items).toHaveLength(1)
      expect(newState.items[0]).toEqual(newItem)
    })
  })
})