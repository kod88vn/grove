function isNumber(value) {
  return typeof value === 'number' && Number.isFinite(value)
}

function prefixErrors(prefix, errors) {
  return errors.map((error) => `${prefix}.${error}`)
}

export function validateWeatherPayload(payload) {
  if (!payload || typeof payload !== 'object') {
    return { ok: false, errors: ['payload must be an object'] }
  }

  const errors = []

  if (!payload.location || typeof payload.location.label !== 'string') {
    errors.push('location.label must be a string')
  }

  if (!payload.current || !isNumber(payload.current.temperatureF)) {
    errors.push('current.temperatureF must be a finite number')
  }

  if (!payload.current || typeof payload.current.condition !== 'string') {
    errors.push('current.condition must be a string')
  }

  if (!payload.today || !isNumber(payload.today.highF)) {
    errors.push('today.highF must be a finite number')
  }

  if (!payload.today || !isNumber(payload.today.lowF)) {
    errors.push('today.lowF must be a finite number')
  }

  if (!payload.today || !isNumber(payload.today.precipChancePct)) {
    errors.push('today.precipChancePct must be a finite number')
  }

  if (!payload.source || typeof payload.source.provider !== 'string') {
    errors.push('source.provider must be a string')
  }

  return {
    ok: errors.length === 0,
    errors,
  }
}

export function validateDashboardPayload(payload) {
  if (!payload || typeof payload !== 'object') {
    return { ok: false, errors: ['payload must be an object'] }
  }

  const errors = []

  if (!payload.profile || typeof payload.profile.summary !== 'string') {
    errors.push('profile.summary must be a string')
  }

  if (!payload.profile || !Number.isFinite(payload.profile.sourceCount)) {
    errors.push('profile.sourceCount must be a finite number')
  }

  if (!Array.isArray(payload.brief)) {
    errors.push('brief must be an array')
  }

  if (!Array.isArray(payload.reminders)) {
    errors.push('reminders must be an array')
  }

  return {
    ok: errors.length === 0,
    errors,
  }
}

export function validateNightlyDigestPayload(payload) {
  if (!payload || typeof payload !== 'object') {
    return { ok: false, errors: ['payload must be an object'] }
  }

  const errors = []

  if (typeof payload.generatedAt !== 'string') {
    errors.push('generatedAt must be a string')
  }

  if (!payload.delivery || typeof payload.delivery.channel !== 'string') {
    errors.push('delivery.channel must be a string')
  }

  if (!payload.delivery || typeof payload.delivery.address !== 'string') {
    errors.push('delivery.address must be a string')
  }

  if (!payload.sections || !Array.isArray(payload.sections.reminders)) {
    errors.push('sections.reminders must be an array')
  }

  if (!payload.sections || !Array.isArray(payload.sections.shoppingList)) {
    errors.push('sections.shoppingList must be an array')
  }

  if (!payload.sections || !payload.sections.weather || typeof payload.sections.weather !== 'object') {
    errors.push('sections.weather must be an object')
  } else {
    const weatherValidation = validateWeatherPayload(payload.sections.weather)
    if (!weatherValidation.ok) {
      errors.push(...prefixErrors('sections.weather', weatherValidation.errors))
    }
  }

  if (!payload.sections || !Array.isArray(payload.sections.market)) {
    errors.push('sections.market must be an array')
  }

  if (!payload.sections || !Array.isArray(payload.sections.news)) {
    errors.push('sections.news must be an array')
  }

  return {
    ok: errors.length === 0,
    errors,
  }
}

export function validateResponse(schemaName, payload) {
  if (schemaName === 'weather_v1') {
    return validateWeatherPayload(payload)
  }

  if (schemaName === 'dashboard_v1') {
    return validateDashboardPayload(payload)
  }

  if (schemaName === 'nightly_digest_v1') {
    return validateNightlyDigestPayload(payload)
  }

  return { ok: true, errors: [] }
}