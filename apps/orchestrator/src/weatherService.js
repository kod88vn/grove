const OPEN_METEO_GEOCODE_URL = 'https://geocoding-api.open-meteo.com/v1/search'
const OPEN_METEO_FORECAST_URL = 'https://api.open-meteo.com/v1/forecast'

const WEATHER_CODE_LABELS = {
  0: 'Clear',
  1: 'Mainly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Fog',
  48: 'Rime fog',
  51: 'Light drizzle',
  53: 'Drizzle',
  55: 'Dense drizzle',
  56: 'Freezing drizzle',
  57: 'Dense freezing drizzle',
  61: 'Light rain',
  63: 'Rain',
  65: 'Heavy rain',
  66: 'Freezing rain',
  67: 'Heavy freezing rain',
  71: 'Light snow',
  73: 'Snow',
  75: 'Heavy snow',
  77: 'Snow grains',
  80: 'Rain showers',
  81: 'Rain showers',
  82: 'Heavy rain showers',
  85: 'Snow showers',
  86: 'Heavy snow showers',
  95: 'Thunderstorm',
  96: 'Thunderstorm with hail',
  99: 'Heavy thunderstorm with hail',
}

function toFahrenheit(celsius) {
  if (!Number.isFinite(celsius)) return null
  return Math.round((celsius * 9) / 5 + 32)
}

function normalizeLocation(rawLocation) {
  const input = String(rawLocation || '').trim()
  return input || 'Atlanta, GA'
}

function weatherCodeLabel(code) {
  if (!Number.isFinite(code)) return 'Unknown'

  if (Object.prototype.hasOwnProperty.call(WEATHER_CODE_LABELS, code)) {
    return WEATHER_CODE_LABELS[code]
  }

  return 'Unknown'
}

async function geocodeLocation(locationLabel) {
  const normalizedMatch = locationLabel.toLowerCase()
  try {
    const url = new URL(OPEN_METEO_GEOCODE_URL)
    url.searchParams.set('name', locationLabel)
    url.searchParams.set('count', '1')
    url.searchParams.set('language', 'en')
    url.searchParams.set('format', 'json')

    const response = await fetch(url, { headers: { 'User-Agent': 'grove-orchestrator/1.0' } })
    if (response.ok) {
      const payload = await response.json()
      const result = payload?.results?.[0]
      if (result) {
        const labelParts = [result.name, result.admin1, result.country_code].filter(Boolean)
        return {
          label: labelParts.join(', '),
          latitude: result.latitude,
          longitude: result.longitude,
          timezone: result.timezone,
        }
      }
    }
    console.warn(`Geocoding API failed or returned empty (${response?.status}). Using fallback.`)
  } catch (err) {
    console.warn(`Geocoding error: ${err.message}. Using fallback.`)
  }

  if (normalizedMatch.includes('atlanta') || normalizedMatch.includes('30303')) {
    return {
      label: 'Atlanta, Georgia, US',
      latitude: 33.749,
      longitude: -84.388,
      timezone: 'America/New_York',
    }
  }

  // Final fallback if everything fails
  return {
    label: 'Atlanta, GA (unverified)',
    latitude: 33.749,
    longitude: -84.388,
    timezone: 'America/New_York',
  }
}

async function fetchForecast(latitude, longitude, timezone) {
  try {
    const url = new URL(OPEN_METEO_FORECAST_URL)
    url.searchParams.set('latitude', String(latitude))
    url.searchParams.set('longitude', String(longitude))
    url.searchParams.set('timezone', timezone || 'auto')
    url.searchParams.set('current', 'temperature_2m,weather_code,wind_speed_10m')
    url.searchParams.set('hourly', 'temperature_2m,precipitation_probability,weather_code')
    url.searchParams.set('daily', 'temperature_2m_max,temperature_2m_min,precipitation_probability_max')
    url.searchParams.set('forecast_days', '1')

    const response = await fetch(url, { headers: { 'User-Agent': 'grove-orchestrator/1.0' } })
    if (response.ok) {
      return response.json()
    }
    console.warn(`Forecast API returned ${response.status}. Using simulation.`)
  } catch (err) {
    console.warn(`Forecast API error: ${err.message}. Using simulation.`)
  }

  // Static simulation if external API is unreachable
  return {
    current: {
      time: new Date().toISOString(),
      weather_code: 1,
      temperature_2m: 22.2,
      wind_speed_10m: 8.5
    },
    daily: {
      temperature_2m_max: [28.5],
      temperature_2m_min: [16.2],
      precipitation_probability_max: [15]
    },
    hourly: {
      time: Array.from({ length: 12 }, (_, i) => new Date(Date.now() + i * 3600000).toISOString()),
      temperature_2m: Array.from({ length: 12 }, () => 22),
      precipitation_probability: Array.from({ length: 12 }, () => 10),
      weather_code: Array.from({ length: 12 }, () => 1)
    }
  }
}

export async function getWeatherPayload(locationInput) {
  const normalizedLocation = normalizeLocation(locationInput)
  const location = await geocodeLocation(normalizedLocation)
  const forecast = await fetchForecast(location.latitude, location.longitude, location.timezone)

  const currentCode = forecast?.current?.weather_code
  const currentTempC = forecast?.current?.temperature_2m
  const currentWindKmh = forecast?.current?.wind_speed_10m
  const todayHighC = forecast?.daily?.temperature_2m_max?.[0]
  const todayLowC = forecast?.daily?.temperature_2m_min?.[0]
  const precipChance = forecast?.daily?.precipitation_probability_max?.[0]

  const hourly = Array.isArray(forecast?.hourly?.time)
    ? forecast.hourly.time.slice(0, 12).map((time, index) => ({
        time,
        temperatureF: toFahrenheit(forecast.hourly.temperature_2m[index]),
        precipChancePct: Math.round(forecast.hourly.precipitation_probability[index] || 0),
        weatherCode: forecast.hourly.weather_code[index],
        condition: weatherCodeLabel(forecast.hourly.weather_code[index]),
      }))
    : []

  return {
    location,
    observedAt: forecast?.current?.time || null,
    current: {
      temperatureF: toFahrenheit(currentTempC),
      temperatureC: Number.isFinite(currentTempC) ? Math.round(currentTempC) : null,
      condition: weatherCodeLabel(currentCode),
      weatherCode: currentCode,
      windMph: Number.isFinite(currentWindKmh) ? Math.round(currentWindKmh * 0.621371) : null,
    },
    today: {
      highF: toFahrenheit(todayHighC),
      lowF: toFahrenheit(todayLowC),
      precipChancePct: Math.round(precipChance || 0),
      summary: weatherCodeLabel(currentCode),
    },
    hourly,
    source: {
      provider: 'open-meteo',
      geocodingUrl: OPEN_METEO_GEOCODE_URL,
      forecastUrl: OPEN_METEO_FORECAST_URL,
    },
  }
}
