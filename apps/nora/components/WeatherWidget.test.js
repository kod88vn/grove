import { describe, it, expect, jest, beforeEach } from '@jest/globals'
import { render, screen, waitFor } from '@testing-library/react'
import { ReadableStream as NodeReadableStream } from 'node:stream/web'
import { TextEncoder as NodeTextEncoder, TextDecoder as NodeTextDecoder } from 'node:util'
import { WeatherWidget } from './WeatherWidget'

if (!global.TextDecoder) global.TextDecoder = NodeTextDecoder
if (!global.ReadableStream) global.ReadableStream = NodeReadableStream

/** Build a fake SSE fetch response with the given word tokens */
function makeSseResponse(...words) {
  const encoder = new NodeTextEncoder()
  const chunks = words.map((w) => `data: ${JSON.stringify({ word: w })}\n\n`)
  const body = new NodeReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk))
      controller.close()
    },
  })
  return { ok: true, body }
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

  it('calls /api/chat with a weather question on mount', async () => {
    global.fetch.mockResolvedValue(makeSseResponse())

    render(<WeatherWidget />)

    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/chat',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('weather'),
        })
      )
    )
  })

  it('streams and displays forecast text then exits loading', async () => {
    global.fetch.mockResolvedValue(makeSseResponse('Sunny ', '25°C.'))

    render(<WeatherWidget />)

    // Loading message disappears when stream completes (status → done)
    await waitFor(() =>
      expect(screen.queryByText(/Checking the forecast/i)).not.toBeInTheDocument()
    )
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
    global.fetch.mockResolvedValue(makeSseResponse())

    const { rerender } = render(<WeatherWidget />)
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1))

    rerender(<WeatherWidget />)
    expect(global.fetch).toHaveBeenCalledTimes(1)
  })
})
