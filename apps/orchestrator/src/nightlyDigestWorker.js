import fs from 'node:fs'
import path from 'node:path'

import { createAuditEvent, logAuditEvent } from './auditLogger.js'
import { buildNightlyDigest } from './nightlyDigest.js'
import { validateResponse } from './responseValidator.js'
import { sendNightlyDigest, createEmailSenderFromEnv } from './nightlyDigestSender.js'

const DIGEST_STORE_PATH = process.env.DIGEST_STORE_PATH || path.join(process.cwd(), '.digest-store.json')

function generateRequestId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

function normalizeClockValue(value, fallback) {
  const parsed = Number(value)
  return Number.isInteger(parsed) ? parsed : fallback
}

export function computeNextRunAt(now = new Date(), hour = 6, minute = 30) {
  const target = new Date(now)
  target.setHours(hour, minute, 0, 0)
  if (target <= now) {
    target.setDate(target.getDate() + 1)
  }
  return target
}

export async function runNightlyDigestJob(options = {}) {
  const requestId = options.requestId || generateRequestId()
  const runAt = options.runAt || new Date().toISOString()
  const digestBuilder = options.digestBuilder || buildNightlyDigest
  const digestSender = options.digestSender || sendNightlyDigest
  const logEvent = options.logAuditEvent || logAuditEvent
  const makeAuditEvent = options.createAuditEvent || createAuditEvent

  const plan = {
    route: 'scheduled_job',
    jobName: 'nightly_digest',
    responseMode: 'structured_data',
    schemaName: 'nightly_digest_v1',
  }

  try {
    const payload = await digestBuilder({
      location: options.location,
      phoneNumber: options.phoneNumber,
      carrier: options.carrier,
      generatedAt: runAt,
      remindersProvider: options.remindersProvider,
      shoppingListProvider: options.shoppingListProvider,
      weatherProvider: options.weatherProvider,
      marketProvider: options.marketProvider,
      newsProvider: options.newsProvider,
    })

    const validation = validateResponse('nightly_digest_v1', payload)
    if (!validation.ok) {
      throw new Error(`Nightly digest validation failed: ${validation.errors.join('; ')}`)
    }

    let delivery = null

    if (digestSender) {
      delivery = await digestSender(payload, {
        emailSender: options.emailSender,
        env: options.env,
        maxLength: options.maxLength,
        subject: options.subject,
      })

      logEvent(
        makeAuditEvent({
          requestId,
          route: '/nightly-digest',
          method: 'SCHEDULED',
          plan,
          outcome: 'success',
          metadata: {
            channel: payload.delivery.channel,
            address: payload.delivery.address,
            generatedAt: payload.generatedAt,
            deliveryId: delivery?.id || null,
          },
        })
      )
    } else {
      const storeDir = path.dirname(DIGEST_STORE_PATH)
      fs.mkdirSync(storeDir, { recursive: true })
      const storeData = { ok: true, payload, delivery: null, requestId, storedAt: new Date().toISOString() }
      fs.writeFileSync(DIGEST_STORE_PATH, JSON.stringify(storeData, null, 2))

      logEvent(
        makeAuditEvent({
          requestId,
          route: '/nightly-digest',
          method: 'SCHEDULED',
          plan,
          outcome: 'success',
          metadata: {
            channel: payload.delivery.channel,
            address: payload.delivery.address,
            generatedAt: payload.generatedAt,
            deliveryId: 'file_store',
          },
        })
      )
    }

    return {
      ok: true,
      payload,
      delivery,
      requestId,
    }
  } catch (error) {
    logEvent(
      makeAuditEvent({
        requestId,
        route: '/nightly-digest',
        method: 'SCHEDULED',
        plan,
        outcome: 'failure',
        error: {
          code: 'NIGHTLY_DIGEST_FAILED',
          message: error instanceof Error ? error.message : 'unknown_error',
        },
      })
    )

    throw error
  }
}

export function startNightlyDigestWorker(options = {}) {
  const hour = normalizeClockValue(options.hour ?? process.env.DIGEST_RUN_HOUR_LOCAL, 6)
  const minute = normalizeClockValue(options.minute ?? process.env.DIGEST_RUN_MINUTE_LOCAL, 30)
  const log = options.log || console

  let timer = null
  let stopped = false
  let nextRunAt = null

  const schedule = () => {
    if (stopped) {
      return
    }

    nextRunAt = computeNextRunAt(new Date(), hour, minute)
    const delayMs = Math.max(0, nextRunAt.getTime() - Date.now())
    timer = setTimeout(async () => {
      try {
        await runNightlyDigestJob(options)
        log.info?.(`[nightly-digest] completed run at ${new Date().toISOString()}`)
      } catch (error) {
        log.error?.(`[nightly-digest] run failed: ${error instanceof Error ? error.message : 'unknown_error'}`)
      } finally {
        schedule()
      }
    }, delayMs)

    log.info?.(`[nightly-digest] next run at ${nextRunAt.toISOString()}`)
  }

  const env = options.env || process.env
  const emailSender = createEmailSenderFromEnv(env)

  const workerOptions = { ...options, env }
  if (emailSender) {
    workerOptions.emailSender = emailSender
  }

  const runOnStart = Boolean(options.runOnStart)
  if (runOnStart) {
    runNightlyDigestJob(workerOptions)
      .catch((error) => {
        log.error?.(`[nightly-digest] startup run failed: ${error instanceof Error ? error.message : 'unknown_error'}`)
      })
      .finally(() => {
        schedule()
      })
  } else {
    schedule()
  }

  return {
    stop() {
      stopped = true
      if (timer) {
        clearTimeout(timer)
      }
    },
    getNextRunAt() {
      return nextRunAt
    },
  }
}

export function loadStoredDigest() {
  try {
    if (!fs.existsSync(DIGEST_STORE_PATH)) return null
    const raw = fs.readFileSync(DIGEST_STORE_PATH, 'utf8')
    return JSON.parse(raw)
  } catch {
    return null
  }
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  startNightlyDigestWorker({
    runOnStart: String(process.env.DIGEST_RUN_ON_START || '').toLowerCase() === '1'
      || String(process.env.DIGEST_RUN_ON_START || '').toLowerCase() === 'true',
  })
}
