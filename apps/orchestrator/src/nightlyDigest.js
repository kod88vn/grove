import { getWeatherPayload } from './weatherService.js'

const CARRIER_GATEWAYS = {
  att: 'txt.att.net',
  atandt: 'txt.att.net',
  verizon: 'vtext.com',
  tmobile: 'tmomail.net',
  sprint: 'messaging.sprintpcs.com',
  uscellular: 'email.uscc.net',
  cricket: 'sms.cricketwireless.net',
}

function normalizePhoneNumber(phoneNumber) {
  return String(phoneNumber || '').replace(/\D/g, '')
}

function normalizeList(value) {
  return Array.isArray(value) ? value : []
}

function resolveCarrierGateway(carrier) {
  const normalizedCarrier = String(carrier || 'att').trim().toLowerCase()
  return CARRIER_GATEWAYS[normalizedCarrier] || null
}

export function resolveEmailToSmsAddress(phoneNumber, carrier = 'att') {
  const normalizedPhoneNumber = normalizePhoneNumber(phoneNumber)
  if (normalizedPhoneNumber.length !== 10 && normalizedPhoneNumber.length !== 11) {
    throw new Error('phoneNumber must contain 10 or 11 digits')
  }

  const gateway = resolveCarrierGateway(carrier)
  if (!gateway) {
    throw new Error(`Unsupported carrier: ${carrier}`)
  }

  const localNumber = normalizedPhoneNumber.length === 11 && normalizedPhoneNumber.startsWith('1')
    ? normalizedPhoneNumber.slice(1)
    : normalizedPhoneNumber

  if (localNumber.length !== 10) {
    throw new Error('phoneNumber must contain a US 10-digit local number')
  }

  return `${localNumber}@${gateway}`
}

export function createNightlyDigestPayload(options = {}) {
  const generatedAt = options.generatedAt || new Date().toISOString()
  const carrier = String(options.carrier || 'att').trim().toLowerCase()
  const deliveryAddress = options.deliveryAddress || resolveEmailToSmsAddress(options.phoneNumber, carrier)

  return {
    generatedAt,
    delivery: {
      channel: 'email_to_sms',
      carrier,
      address: deliveryAddress,
      phoneNumber: normalizePhoneNumber(options.phoneNumber).replace(/^1(?=\d{10}$)/, ''),
    },
    sections: {
      reminders: normalizeList(options.reminders),
      shoppingList: normalizeList(options.shoppingList),
      weather: options.weather || null,
      market: normalizeList(options.market),
      news: normalizeList(options.news),
    },
  }
}

export async function buildNightlyDigest(options = {}) {
  const location = options.location || process.env.GROVE_LOCATION || 'Atlanta, Georgia, USA'
  const phoneNumber = options.phoneNumber || process.env.DIGEST_PHONE_NUMBER || ''
  const carrier = options.carrier || process.env.DIGEST_CARRIER || 'att'

  const remindersProvider = options.remindersProvider || (async () => [])
  const shoppingListProvider = options.shoppingListProvider || (async () => [])
  const weatherProvider = options.weatherProvider || getWeatherPayload
  const marketProvider = options.marketProvider || (async () => [])
  const newsProvider = options.newsProvider || (async () => [])

  const [reminders, shoppingList, weather, market, news] = await Promise.all([
    remindersProvider({ location, carrier, phoneNumber }),
    shoppingListProvider({ location, carrier, phoneNumber }),
    weatherProvider(location),
    marketProvider({ location, carrier, phoneNumber }),
    newsProvider({ location, carrier, phoneNumber }),
  ])

  return createNightlyDigestPayload({
    generatedAt: options.generatedAt,
    phoneNumber,
    carrier,
    reminders,
    shoppingList,
    weather,
    market,
    news,
  })
}