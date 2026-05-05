'use client'

import { useEffect, useRef, useState } from 'react'
import { parseSseStream } from '@/lib/utils/sseStream'

const DEFAULT_MODEL = process.env.NEXT_PUBLIC_DEFAULT_MODEL || 'qwen3.5:9b'

/**
 * Automatically asks Nora for today's weather on mount and streams the response.
 * No props required — location is injected server-side via the system prompt.
 */
export function WeatherWidget() {
  const [text, setText] = useState('')
  const [status, setStatus] = useState('loading') // loading | done | error
  const fetchedRef = useRef(false)

  useEffect(() => {
    if (fetchedRef.current) return
    fetchedRef.current = true

    async function fetchWeather() {
      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: DEFAULT_MODEL,
            messages: [
              {
                role: 'user',
                content:
                  "What's today's weather forecast for our location? Give me the current conditions and a brief outlook for the rest of the day. Keep it concise — 2-3 sentences.",
              },
            ],
          }),
        })

        if (!res.ok) throw new Error('Request failed')

        for await (const event of parseSseStream(res)) {
          if (event.word) {
            setText((prev) => prev + event.word)
          }
        }
        setStatus('done')
      } catch {
        setStatus('error')
      }
    }

    fetchWeather()
  }, [])

  if (status === 'error') {
    return (
      <p className="text-sm text-slate-500">
        Unable to fetch weather right now. Ask Nora directly in chat.
      </p>
    )
  }

  if (status === 'loading' && !text) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-400">
        <span className="inline-block h-3 w-3 animate-pulse rounded-full bg-cyan-400" />
        Checking the forecast…
      </div>
    )
  }

  return (
    <p className="text-sm leading-6 text-slate-700 whitespace-pre-wrap">
      {text}
      {status === 'loading' && (
        <span className="ml-1 inline-block h-3 w-1 animate-pulse rounded-sm bg-cyan-500" />
      )}
    </p>
  )
}
