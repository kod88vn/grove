import nodemailer from 'nodemailer'

function truncateText(text, maxLength) {
  if (text.length <= maxLength) {
    return text
  }
  return `${text.slice(0, Math.max(0, maxLength - 3))}...`
}

function formatListSection(title, items, formatter) {
  if (!Array.isArray(items) || items.length === 0) {
    return `${title}: none`
  }

  const lines = items.slice(0, 5).map((item, index) => `${index + 1}. ${formatter(item)}`)
  return `${title}:\n${lines.join('\n')}`
}

export function formatNightlyDigestMessage(payload, options = {}) {
  const maxLength = Number.isFinite(options.maxLength) ? Number(options.maxLength) : 1200
  const reminders = payload?.sections?.reminders || []
  const shoppingList = payload?.sections?.shoppingList || []
  const weather = payload?.sections?.weather || {}
  const market = payload?.sections?.market || []
  const news = payload?.sections?.news || []

  const weatherLine = weather?.today
    ? `Weather: ${weather.location?.label || 'Unknown'} | ${weather.current?.condition || 'Unknown'} ${weather.current?.temperatureF ?? '--'}F | H:${weather.today.highF ?? '--'} L:${weather.today.lowF ?? '--'} Rain:${weather.today.precipChancePct ?? '--'}%`
    : 'Weather: unavailable'

  const body = [
    `Grove Morning Digest (${String(payload?.generatedAt || '').slice(0, 10) || 'unknown date'})`,
    weatherLine,
    formatListSection('Reminders', reminders, (item) => `${item.title || 'Untitled'} (${item.dueLabel || 'no due'})`),
    formatListSection('Shopping', shoppingList, (item) => `${item.label || 'Unnamed'}${item.note ? ` - ${item.note}` : ''}`),
    formatListSection('Market', market, (item) => `${item.symbol || item.title || 'Item'}${Number.isFinite(item.changePct) ? ` ${item.changePct}%` : ''}`),
    formatListSection('News', news, (item) => item.title || item.url || 'Untitled'),
  ].join('\n\n')

  return truncateText(body, maxLength)
}

export function createDryRunEmailSender() {
  return async ({ to, subject, text }) => ({
    ok: true,
    id: 'dry-run',
    provider: 'dry_run',
    to,
    subject,
    preview: text.slice(0, 120),
  })
}

export function createSmtpEmailSender(options = {}) {
  const host = String(options.host || '').trim()
  const port = Number(options.port || 587)
  const secure = options.secure === true || String(options.secure || '').toLowerCase() === 'true'
  const user = String(options.user || '').trim()
  const pass = String(options.pass || '').trim()
  const from = String(options.from || '').trim()
  const transportFactory = options.transportFactory || nodemailer.createTransport

  if (!host) {
    throw new Error('Missing SMTP host')
  }

  if (!from) {
    throw new Error('Missing SMTP from address')
  }

  const transport = transportFactory({
    host,
    port,
    secure,
    auth: user && pass ? { user, pass } : undefined,
  })

  return async ({ to, subject, text }) => {
    const info = await transport.sendMail({
      from,
      to,
      subject,
      text,
    })

    return {
      ok: true,
      id: info.messageId || `smtp-${Date.now().toString(36)}`,
      provider: 'smtp',
      accepted: info.accepted || [],
      rejected: info.rejected || [],
    }
  }
}

export function createWebhookEmailSender(options = {}) {
  const endpoint = String(options.endpoint || '').trim()
  const authToken = String(options.authToken || '').trim()
  const fetchImpl = options.fetchImpl || fetch

  if (!endpoint) {
    throw new Error('Missing webhook endpoint')
  }

  return async ({ to, subject, text, metadata }) => {
    const response = await fetchImpl(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      },
      body: JSON.stringify({ to, subject, text, metadata }),
    })

    if (!response.ok) {
      throw new Error(`Webhook sender failed with status ${response.status}`)
    }

    let payload = null
    try {
      payload = await response.json()
    } catch {
      payload = null
    }

    return {
      ok: true,
      id: payload?.id || `webhook-${Date.now().toString(36)}`,
      provider: 'webhook',
    }
  }
}

export function createEmailSenderFromEnv(env = process.env) {
  if (String(env.DIGEST_DRY_RUN || '').toLowerCase() === '1' || String(env.DIGEST_DRY_RUN || '').toLowerCase() === 'true') {
    return createDryRunEmailSender()
  }

  if (env.DIGEST_SMTP_HOST) {
    return createSmtpEmailSender({
      host: env.DIGEST_SMTP_HOST,
      port: env.DIGEST_SMTP_PORT,
      secure: env.DIGEST_SMTP_SECURE,
      user: env.DIGEST_SMTP_USER,
      pass: env.DIGEST_SMTP_PASS,
      from: env.DIGEST_SMTP_FROM,
    })
  }

  if (env.DIGEST_EMAIL_WEBHOOK_URL) {
    return createWebhookEmailSender({
      endpoint: env.DIGEST_EMAIL_WEBHOOK_URL,
      authToken: env.DIGEST_EMAIL_WEBHOOK_TOKEN,
    })
  }

  return null
}

export async function sendNightlyDigest(payload, options = {}) {
  const to = payload?.delivery?.address
  if (!to) {
    throw new Error('Nightly digest payload is missing delivery.address')
  }

  const sender = options.emailSender || createEmailSenderFromEnv(options.env)
  if (!sender) {
    throw new Error('No email sender configured. Set DIGEST_SMTP_HOST plus DIGEST_SMTP_FROM, or enable DIGEST_DRY_RUN=1, or configure DIGEST_EMAIL_WEBHOOK_URL.')
  }

  const subject = options.subject || `Grove Morning Digest ${String(payload.generatedAt || '').slice(0, 10)}`
  const text = options.messageText || formatNightlyDigestMessage(payload, { maxLength: options.maxLength })

  return sender({
    to,
    subject,
    text,
    metadata: {
      generatedAt: payload.generatedAt,
      channel: payload?.delivery?.channel || 'email_to_sms',
    },
  })
}
