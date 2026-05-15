import test from 'node:test'
import assert from 'node:assert/strict'

import { buildNightlyDigest, createNightlyDigestPayload, resolveEmailToSmsAddress } from './nightlyDigest.js'

test('Given a phone number and AT&T carrier, when resolving delivery address, then the text gateway is used', () => {
  assert.equal(resolveEmailToSmsAddress('(770) 555-1234', 'att'), '7705551234@txt.att.net')
  assert.equal(resolveEmailToSmsAddress('1-770-555-1234', 'ATT'), '7705551234@txt.att.net')
})

test('Given invalid phone number input, when resolving delivery address, then it rejects', () => {
  assert.throws(() => resolveEmailToSmsAddress('555', 'att'), /10 or 11 digits/)
  assert.throws(() => resolveEmailToSmsAddress('7705551234', 'unknown'), /Unsupported carrier/)
})

test('Given source providers, when building the nightly digest, then a structured payload is returned', async () => {
  const payload = await buildNightlyDigest({
    generatedAt: '2026-05-12T04:00:00.000Z',
    phoneNumber: '7705551234',
    carrier: 'att',
    location: 'Duluth, GA',
    remindersProvider: async () => [{ id: 'r1', title: 'Take out trash', dueLabel: 'Tonight', completed: false }],
    shoppingListProvider: async () => [{ id: 's1', label: 'Milk', checked: false, note: '2%' }],
    weatherProvider: async () => ({
      location: { label: 'Duluth, Georgia, US' },
      current: { temperatureF: 73, condition: 'Partly cloudy' },
      today: { highF: 75, lowF: 61, precipChancePct: 20 },
      source: { provider: 'open-meteo' },
    }),
    marketProvider: async () => [{ symbol: 'VTI', changePct: 0.8 }],
    newsProvider: async () => [{ title: 'Markets opened higher', url: 'https://example.com/story' }],
  })

  assert.equal(payload.generatedAt, '2026-05-12T04:00:00.000Z')
  assert.equal(payload.delivery.channel, 'email_to_sms')
  assert.equal(payload.delivery.address, '7705551234@txt.att.net')
  assert.equal(payload.sections.reminders.length, 1)
  assert.equal(payload.sections.shoppingList[0].label, 'Milk')
  assert.equal(payload.sections.weather.current.condition, 'Partly cloudy')
  assert.equal(payload.sections.market.length, 1)
  assert.equal(payload.sections.news.length, 1)
})

test('Given explicit delivery address, when creating payload, then phone gateway resolution is skipped', () => {
  const payload = createNightlyDigestPayload({
    generatedAt: '2026-05-12T04:00:00.000Z',
    deliveryAddress: 'me@example.com',
    reminders: [],
    shoppingList: [],
    weather: {
      location: { label: 'Duluth, Georgia, US' },
      current: { temperatureF: 73, condition: 'Partly cloudy' },
      today: { highF: 75, lowF: 61, precipChancePct: 20 },
      source: { provider: 'open-meteo' },
    },
  })

  assert.equal(payload.delivery.address, 'me@example.com')
  assert.equal(payload.delivery.channel, 'email_to_sms')
  assert.equal(Array.isArray(payload.sections.reminders), true)
})