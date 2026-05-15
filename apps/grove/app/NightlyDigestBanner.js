'use client'

import { useEffect, useState } from 'react'

export default function NightlyDigestBanner() {
  const [digest, setDigest] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/nightly-digest')
      .then((res) => res.json())
      .then((data) => {
        setDigest(data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return null
  if (!digest || !digest.ok) return null

  const { sections, generatedAt } = digest

  return (
    <section className="mb-8 rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50 to-white p-6 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-xl">🌅</span>
        <h2 className="text-lg font-semibold text-indigo-900">Morning Briefing</h2>
        <span className="text-xs text-indigo-500">
          {generatedAt ? new Date(generatedAt).toLocaleTimeString() : 'just now'}
        </span>
      </div>

      {/* Weather */}
      {sections.weather && sections.weather.temperatureF ? (
        <div className="mb-3 rounded-lg bg-white/70 p-3 text-sm">
          <p className="font-medium text-slate-800">
            Weather: {sections.weather.temperatureF}°F — {sections.weather.condition || 'N/A'}
          </p>
        </div>
      ) : null}

      {/* Reminders */}
      {sections.reminders && sections.reminders.length > 0 ? (
        <div className="mb-3 rounded-lg bg-white/70 p-3 text-sm">
          <p className="mb-1 font-medium text-slate-800">Reminders:</p>
          <ul className="list-inside list-disc text-slate-600">
            {sections.reminders.slice(0, 5).map((r) => (
              <li key={r.id || r.title}>{r.title}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* Shopping List */}
      {sections.shoppingList && sections.shoppingList.length > 0 ? (
        <div className="mb-3 rounded-lg bg-white/70 p-3 text-sm">
          <p className="mb-1 font-medium text-slate-800">Shopping List:</p>
          <ul className="list-inside list-disc text-slate-600">
            {sections.shoppingList.slice(0, 5).map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* Full briefing toggle */}
      {digest.messageText ? (
        <details className="mt-2">
          <summary className="cursor-pointer text-sm font-medium text-indigo-700">View full briefing</summary>
          <pre className="mt-2 max-h-64 overflow-auto rounded bg-white/80 p-3 text-xs leading-relaxed text-slate-700">
            {digest.messageText}
          </pre>
        </details>
      ) : null}
    </section>
  )
}