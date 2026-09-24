import test from 'node:test'
import assert from 'node:assert/strict'

import { getWeatherPayload } from './weatherService.js'

test('Given a location, when weather is requested, then payload is normalized JSON', async (t) => {
  const originalFetch = global.fetch

  t.after(() => {
    global.fetch = originalFetch
  })

  let callIndex = 0
  global.fetch = async () => {
    callIndex += 1

    if (callIndex === 1) {
      return {
        ok: true,
        json: async () => ({
          results: [
            {
              name: 'Atlanta',
              admin1: 'Georgia',
              country_code: 'US',
              latitude: 33.749,
              longitude: -84.388,
              timezone: 'America/New_York',
            },
          ],
        }),
      }
    }

    return {
      ok: true,
      json: async () => ({
        current: {
          time: '2026-05-06T12:00',
          temperature_2m: 22.8,
          weather_code: 2,
          wind_speed_10m: 16,
        },
        daily: {
          temperature_2m_max: [23.5],
          temperature_2m_min: [16.2],
          precipitation_probability_max: [40],
        },
        hourly: {
          time: ['2026-05-06T12:00', '2026-05-06T13:00'],
          temperature_2m: [22.8, 23.1],
          precipitation_probability: [40, 35],
          weather_code: [2, 3],
        },
      }),
    }
  }

  const payload = await getWeatherPayload('Atlanta, GA')

  assert.equal(payload.location.label, 'Atlanta, Georgia, US')
  assert.equal(payload.current.condition, 'Partly cloudy')
  assert.equal(payload.today.precipChancePct, 40)
  assert.equal(Array.isArray(payload.hourly), true)
  assert.equal(payload.source.provider, 'open-meteo')
})
