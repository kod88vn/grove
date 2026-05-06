function isNumber(value) {
  return typeof value === 'number' && Number.isFinite(value)
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

export function validateResponse(schemaName, payload) {
  if (schemaName === 'weather_v1') {
    return validateWeatherPayload(payload)
  }

  if (schemaName === 'dashboard_v1') {
    return validateDashboardPayload(payload)
  }

  return { ok: true, errors: [] }
}