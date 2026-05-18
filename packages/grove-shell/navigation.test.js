import test from 'node:test'
import assert from 'node:assert/strict'

import { NAV_ITEMS, getNavItems, isActiveNavPath } from './navigation.js'

test('nav items expose the full global header surface', () => {
  assert.deepEqual(
    NAV_ITEMS.map((item) => item.href),
    ['/chat', '/games', '/homeworks']
  )
})

test('getNavItems returns a copy', () => {
  const items = getNavItems()
  items.pop()

  assert.equal(NAV_ITEMS.length, 3)
})

test('isActiveNavPath matches exact and nested routes', () => {
  assert.equal(isActiveNavPath('/', '/'), true)
  assert.equal(isActiveNavPath('/games', '/games'), true)
  assert.equal(isActiveNavPath('/games/hangman', '/games'), true)
  // shopping-list and reminders are temporarily hidden from menu
  assert.equal(isActiveNavPath('/chat', '/'), false)
})