import { describe, it, expect, jest, beforeEach } from '@jest/globals'
import { render, screen, waitFor } from '@testing-library/react'
import { WeatherWidget } from './WeatherWidget'

function makeWeatherResponse(overrides = {}) {
  return {
    ok: true,
    json: async () => ({
      location: { label: 'Duluth, GA', timezone: 'America/New_York' },
      observedAt: '2026-05-06T12:00:00-04:00',
      current: {
        temperatureF: 73,
        condition: 'Partly cloudy',
        windMph: 10,
      },
      today: {
        highF: 74,
        lowF: 61,
        precipChancePct: 40,
      },
      source: {
        provider: 'open-meteo',
      },
      ...overrides,
    }),
  }
}

describe('WeatherWidget', () => {
  beforeEach(() => {
    global.fetch = jest.fn()
  })

  it('shows a loading state before the forecast arrives', () => {
    // Fetch never resolves in this test so we stay in loading state
    global.fetch.mockReturnValue(new Promise(() => {}))
    render(<WeatherWidget />)
    expect(screen.getByText(/Checking the forecast/i)).toBeInTheDocument()
  })

  it('calls /api/weather on mount', async () => {
    global.fetch.mockResolvedValue(makeWeatherResponse())

    render(<WeatherWidget />)

    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/weather',
        expect.objectContaining({ method: 'GET' })
      )
    )
  })

  it('renders structured weather fields from JSON response', async () => {
    global.fetch.mockResolvedValue(makeWeatherResponse())

    render(<WeatherWidget />)

    await waitFor(() => expect(screen.getByText(/73°F/i)).toBeInTheDocument())
    expect(screen.getByText(/Partly cloudy/i)).toBeInTheDocument()
    expect(screen.getByText(/H 74°F/i)).toBeInTheDocument()
    expect(screen.getByText(/L 61°F/i)).toBeInTheDocument()
    expect(screen.getByText(/Rain 40%/i)).toBeInTheDocument()
    expect(screen.getByText(/Source: open-meteo/i)).toBeInTheDocument()
  })

  it('shows error state when fetch rejects', async () => {
    global.fetch.mockRejectedValue(new Error('Network error'))

    render(<WeatherWidget />)

    await waitFor(() =>
      expect(screen.getByText(/Unable to fetch weather/i)).toBeInTheDocument()
    )
  })

  it('shows error state when fetch returns non-ok response', async () => {
    global.fetch.mockResolvedValue({ ok: false })

    render(<WeatherWidget />)

    await waitFor(() =>
      expect(screen.getByText(/Unable to fetch weather/i)).toBeInTheDocument()
    )
  })

  it('does not fetch again if re-rendered', async () => {
    global.fetch.mockResolvedValue(makeWeatherResponse())

    const { rerender } = render(<WeatherWidget />)
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1))

    rerender(<WeatherWidget />)
    expect(global.fetch).toHaveBeenCalledTimes(1)
  })
})
