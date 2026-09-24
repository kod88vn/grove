import test from 'node:test'
import assert from 'node:assert/strict'

import { computeNextRunAt, runNightlyDigestJob } from './nightlyDigestWorker.js'

test('Given current time before schedule, when computing next run, then same-day run is returned', () => {
  const now = new Date(2026, 4, 13, 5, 0, 0)
  const next = computeNextRunAt(now, 6, 30)

  assert.equal(next.getFullYear(), 2026)
  assert.equal(next.getMonth(), 4)
  assert.equal(next.getDate(), 13)
  assert.equal(next.getHours(), 6)
  assert.equal(next.getMinutes(), 30)
})

test('Given current time after schedule, when computing next run, then next-day run is returned', () => {
  const now = new Date(2026, 4, 13, 8, 0, 0)
  const next = computeNextRunAt(now, 6, 30)

  assert.equal(next.getFullYear(), 2026)
  assert.equal(next.getMonth(), 4)
  assert.equal(next.getDate(), 14)
  assert.equal(next.getHours(), 6)
  assert.equal(next.getMinutes(), 30)
})

test('Given valid providers and sender, when running nightly digest job, then job succeeds and logs audit success', async () => {
  const events = []
  const result = await runNightlyDigestJob({
    runAt: '2026-05-13T06:30:00.000Z',
    phoneNumber: '7705551234',
    carrier: 'att',
    digestBuilder: async () => ({
      generatedAt: '2026-05-13T06:30:00.000Z',
      delivery: {
        channel: 'email_to_sms',
        address: '7705551234@txt.att.net',
      },
      sections: {
        reminders: [],
        shoppingList: [],
        weather: {
          location: { label: 'Atlanta, Georgia, US' },
          current: { temperatureF: 72, condition: 'Clear' },
          today: { highF: 78, lowF: 61, precipChancePct: 10 },
          source: { provider: 'open-meteo' },
        },
        market: [],
        news: [],
      },
    }),
    digestSender: async () => ({ ok: true, id: 'dry-run' }),
    createAuditEvent: (event) => event,
    logAuditEvent: (event) => {
      events.push(event)
    },
  })

  assert.equal(result.ok, true)
  assert.equal(result.delivery.id, 'dry-run')
  assert.equal(events.length, 1)
  assert.equal(events[0].outcome, 'success')
  assert.equal(events[0].route, '/nightly-digest')
})

test('Given invalid digest payload, when running nightly digest job, then failure is logged and error is thrown', async () => {
  const events = []

  await assert.rejects(
    () => runNightlyDigestJob({
      runAt: '2026-05-13T06:30:00.000Z',
      digestBuilder: async () => ({ message: 'prose payload' }),
      digestSender: async () => ({ ok: true }),
      createAuditEvent: (event) => event,
      logAuditEvent: (event) => {
        events.push(event)
      },
    }),
    /Nightly digest validation failed/
  )

  assert.equal(events.length, 1)
  assert.equal(events[0].outcome, 'failure')
  assert.equal(events[0].error.code, 'NIGHTLY_DIGEST_FAILED')
})
