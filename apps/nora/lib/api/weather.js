const ORCHESTRATOR_URL = process.env.ORCHESTRATOR_URL || 'http://127.0.0.1:4010'

function isNumber(value) {
  return typeof value === 'number' && Number.isFinite(value)
}

export function isValidWeatherPayload(payload) {
  return Boolean(
    payload &&
      payload.location &&
      typeof payload.location.label === 'string' &&
      payload.current &&
      isNumber(payload.current.temperatureF) &&
      typeof payload.current.condition === 'string' &&
      payload.today &&
      isNumber(payload.today.highF) &&
      isNumber(payload.today.lowF) &&
      isNumber(payload.today.precipChancePct)
  )
}

export async function fetchWeather(location = process.env.WEATHER_LOCATION || 'Duluth, GA') {
  try {
    const weatherUrl = `${ORCHESTRATOR_URL}/weather?location=${encodeURIComponent(location)}`
    const response = await fetch(weatherUrl, {
      signal: AbortSignal.timeout(5000)
    })
    
    if (!response.ok) return null
    
    const data = await response.json()
    return isValidWeatherPayload(data) ? data : null
  } catch (err) {
    console.error('Weather fetch error:', err)
    return null
  }
}
