export const SETTINGS_KEY = 'grove.homeworks.settings'

export const DEFAULT_SETTINGS = Object.freeze({
  animations: true,
  sounds: true,
  dyslexiaFont: false,
})

function isPlainObject(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

export function normalizeSettings(raw) {
  if (!isPlainObject(raw)) return { ...DEFAULT_SETTINGS }

  return {
    animations: typeof raw.animations === 'boolean' ? raw.animations : DEFAULT_SETTINGS.animations,
    sounds: typeof raw.sounds === 'boolean' ? raw.sounds : DEFAULT_SETTINGS.sounds,
    dyslexiaFont: typeof raw.dyslexiaFont === 'boolean' ? raw.dyslexiaFont : DEFAULT_SETTINGS.dyslexiaFont,
  }
}

export function readSettings(storage) {
  if (storage === null || storage === undefined || typeof storage.getItem !== 'function') {
    return { ...DEFAULT_SETTINGS }
  }

  let stored
  try {
    stored = storage.getItem(SETTINGS_KEY)
  } catch {
    return { ...DEFAULT_SETTINGS }
  }

  if (stored === null || stored === '') return { ...DEFAULT_SETTINGS }

  let raw
  try {
    raw = JSON.parse(stored)
  } catch {
    return { ...DEFAULT_SETTINGS }
  }

  return normalizeSettings(raw)
}

export function writeSettings(storage, settings) {
  const normalized = normalizeSettings(settings)

  if (storage !== null && storage !== undefined && typeof storage.setItem === 'function') {
    try {
      storage.setItem(SETTINGS_KEY, JSON.stringify(normalized))
    } catch {
      // Storage may be unavailable even when its API exists.
    }
  }

  return normalized
}
