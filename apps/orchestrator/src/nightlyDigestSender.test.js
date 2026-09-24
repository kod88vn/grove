import test from 'node:test'
import assert from 'node:assert/strict'

import {
  createDryRunEmailSender,
  createEmailSenderFromEnv,
  createSmtpEmailSender,
  createWebhookEmailSender,
  formatNightlyDigestMessage,
  sendNightlyDigest,
} from './nightlyDigestSender.js'

function createPayload() {
  return {
    generatedAt: '2026-05-13T06:30:00.000Z',
    delivery: {
      channel: 'email_to_sms',
      address: '7705551234@txt.att.net',
    },
    sections: {
      reminders: [{ title: 'Take vitamins', dueLabel: 'Morning' }],
      shoppingList: [{ label: 'Eggs', note: '1 dozen' }],
      weather: {
        location: { label: 'Atlanta, Georgia, US' },
        current: { temperatureF: 72, condition: 'Clear' },
        today: { highF: 78, lowF: 61, precipChancePct: 10 },
      },
      market: [{ symbol: 'VTI', changePct: 0.4 }],
      news: [{ title: 'Morning briefing ready' }],
    },
  }
}

test('Given digest payload, when formatting message, then it includes key sections', () => {
  const message = formatNightlyDigestMessage(createPayload(), { maxLength: 400 })

  assert.equal(message.includes('Grove Morning Digest'), true)
  assert.equal(message.includes('Reminders'), true)
  assert.equal(message.includes('Shopping'), true)
  assert.equal(message.includes('Weather'), true)
  assert.equal(message.length <= 400, true)
})

test('Given dry-run sender, when sending digest, then delivery metadata is returned', async () => {
  const delivery = await sendNightlyDigest(createPayload(), {
    emailSender: createDryRunEmailSender(),
  })

  assert.equal(delivery.ok, true)
  assert.equal(delivery.id, 'dry-run')
  assert.equal(delivery.provider, 'dry_run')
})

test('Given SMTP sender, when transport accepts mail, then sender returns smtp delivery metadata', async () => {
  let capturedMessage = null
  const sender = createSmtpEmailSender({
    host: 'smtp.example.com',
    port: 587,
    secure: false,
    from: 'grove@example.com',
    user: 'user',
    pass: 'pass',
    transportFactory: () => ({
      async sendMail(message) {
        capturedMessage = message
        return {
          messageId: 'smtp-1',
          accepted: ['7705551234@txt.att.net'],
          rejected: [],
        }
      },
    }),
  })

  const delivery = await sender({
    to: '7705551234@txt.att.net',
    subject: 'Digest',
    text: 'Body',
  })

  assert.equal(capturedMessage.from, 'grove@example.com')
  assert.equal(capturedMessage.to, '7705551234@txt.att.net')
  assert.equal(delivery.ok, true)
  assert.equal(delivery.id, 'smtp-1')
  assert.equal(delivery.provider, 'smtp')
})

test('Given webhook sender, when endpoint accepts request, then sender returns webhook id', async () => {
  const sender = createWebhookEmailSender({
    endpoint: 'https://example.com/digest',
    authToken: 'token-123',
    fetchImpl: async (_url, request) => {
      const body = JSON.parse(request.body)
      assert.equal(body.to, '7705551234@txt.att.net')
      return {
        ok: true,
        json: async () => ({ id: 'msg-1' }),
      }
    },
  })

  const delivery = await sender({
    to: '7705551234@txt.att.net',
    subject: 'Digest',
    text: 'Body',
  })

  assert.equal(delivery.ok, true)
  assert.equal(delivery.id, 'msg-1')
})

test('Given missing sender configuration, when sending digest, then error is thrown', async () => {
  await assert.rejects(
    () => sendNightlyDigest(createPayload(), { env: {} }),
    /No email sender configured/
  )
})

test('Given DIGEST_DRY_RUN env flag, when creating env sender, then dry-run sender is returned', async () => {
  const sender = createEmailSenderFromEnv({ DIGEST_DRY_RUN: 'true' })
  const delivery = await sender({ to: 'x@test.com', subject: 's', text: 't' })

  assert.equal(delivery.ok, true)
  assert.equal(delivery.id, 'dry-run')
})

test('Given SMTP env config, when creating env sender, then smtp sender is returned', async () => {
  const sender = createEmailSenderFromEnv({
    DIGEST_SMTP_HOST: 'smtp.example.com',
    DIGEST_SMTP_FROM: 'grove@example.com',
    DIGEST_SMTP_PORT: '587',
  })

  assert.equal(typeof sender, 'function')
})
