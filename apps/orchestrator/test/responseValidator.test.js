import test from 'node:test'
import assert from 'node:assert/strict'

import { validateResponse } from '../src/responseValidator.js'

test('Given prose payload, when validating weather_v1, then validation fails', () => {
  const result = validateResponse('weather_v1', {
    message: 'It will probably be warm later today.',
  })

  assert.equal(result.ok, false)
  assert.equal(result.errors.includes('location.label must be a string'), true)
})

test('Given normalized weather payload, when validating weather_v1, then validation succeeds', () => {
  const result = validateResponse('weather_v1', {
    location: { label: 'Duluth, Georgia, US' },
    current: { temperatureF: 73, condition: 'Partly cloudy' },
    today: { highF: 74, lowF: 61, precipChancePct: 40 },
    source: { provider: 'open-meteo' },
  })

  assert.equal(result.ok, true)
  assert.deepEqual(result.errors, [])
})

test('Given dashboard payload, when validating dashboard_v1, then validation succeeds', () => {
  const result = validateResponse('dashboard_v1', {
    profile: {
      summary: 'Household focus is school logistics and meal planning.',
      sourceCount: 4,
    },
    brief: [
      { id: 'a', title: 'School pickup plan' },
      { id: 'b', title: 'Dinner prep list' },
    ],
    reminders: [],
  })

  assert.equal(result.ok, true)
  assert.deepEqual(result.errors, [])
})

test('Given prose payload, when validating dashboard_v1, then validation fails', () => {
  const result = validateResponse('dashboard_v1', {
    message: 'No structured dashboard data available right now.',
  })

  assert.equal(result.ok, false)
  assert.equal(result.errors.includes('profile.summary must be a string'), true)
})

test('Given structured nightly digest payload, when validating nightly_digest_v1, then validation succeeds', () => {
  const result = validateResponse('nightly_digest_v1', {
    generatedAt: '2026-05-12T04:00:00.000Z',
    delivery: {
      channel: 'email_to_sms',
      address: '7705551234@txt.att.net',
    },
    sections: {
      reminders: [],
      shoppingList: [],
      weather: {
        location: { label: 'Duluth, Georgia, US' },
        current: { temperatureF: 73, condition: 'Partly cloudy' },
        today: { highF: 75, lowF: 61, precipChancePct: 20 },
        source: { provider: 'open-meteo' },
      },
      market: [],
      news: [],
    },
  })

  assert.equal(result.ok, true)
  assert.deepEqual(result.errors, [])
})

test('Given prose payload, when validating nightly_digest_v1, then validation fails', () => {
  const result = validateResponse('nightly_digest_v1', {
    message: 'The digest can be sent later.',
  })

  assert.equal(result.ok, false)
  assert.equal(result.errors.includes('generatedAt must be a string'), true)
  assert.equal(result.errors.includes('sections.weather must be an object'), true)
})