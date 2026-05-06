'use client'

import { useEffect, useRef, useState } from 'react'

export function WeatherWidget({ initialData = null }) {
  const [forecast, setForecast] = useState(initialData)
  const [status, setStatus] = useState(initialData ? 'done' : 'loading') // loading | done | error
  const fetchedRef = useRef(false)

  useEffect(() => {
    // If we have initial data (SSR), skip the client-side fetch unless we want refreshed data
    if (initialData || fetchedRef.current) return
    fetchedRef.current = true

    async function fetchWeather() {
      try {
        const res = await fetch('/api/weather', {
          method: 'GET',
          headers: { Accept: 'application/json' },
        })

        if (!res.ok) throw new Error('Request failed')

        const payload = await res.json()
        setForecast(payload)
        setStatus('done')
      } catch {
        setStatus('error')
      }
    }

    fetchWeather()
  }, [initialData])

  if (status === 'error') {
    return (
      <p className="text-sm text-slate-500">
        Unable to fetch weather right now. Ask Nora directly in chat.
      </p>
    )
  }

  if (status === 'loading' && !forecast) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-400">
        <span className="inline-block h-3 w-3 animate-pulse rounded-full bg-cyan-400" />
        Checking the forecast…
      </div>
    )
  }

  if (!forecast) {
    return <p className="text-sm text-slate-500">No weather data available.</p>
  }

  const observedLabel = forecast.observedAt ? new Date(forecast.observedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : 'recently'

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[2rem] font-semibold leading-none text-slate-950">{forecast.current.temperatureF}°F</p>
          <p className="mt-2 text-sm font-medium text-slate-700">{forecast.current.condition}</p>
        </div>
        <div className="rounded-2xl border border-cyan-200 bg-cyan-50 px-3 py-2 text-right text-xs font-medium text-cyan-900">
          <p>{forecast.location.label}</p>
          <p className="mt-1 text-cyan-700">Updated {observedLabel}</p>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-3 text-sm text-slate-700 sm:grid-cols-4">
        <DataChip label="High" value={`H ${forecast.today.highF}°F`} />
        <DataChip label="Low" value={`L ${forecast.today.lowF}°F`} />
        <DataChip label="Rain" value={`Rain ${forecast.today.precipChancePct}%`} />
        <DataChip label="Wind" value={`${forecast.current.windMph ?? 0} mph`} />
      </dl>

      <p className="text-xs text-slate-500">Source: {forecast.source?.provider || 'unknown'}</p>
    </div>
  )
}

function DataChip({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
      <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">{label}</dt>
      <dd className="mt-1 font-medium text-slate-800">{value}</dd>
    </div>
  )
}
