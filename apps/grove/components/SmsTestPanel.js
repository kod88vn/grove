'use client'

import { useMemo, useState } from 'react'

const INITIAL_FORM = {
  phoneNumber: '',
  carrier: 'att',
  location: 'Duluth, Georgia, USA',
  dryRun: false,
}

export function SmsTestPanel() {
  const [form, setForm] = useState(INITIAL_FORM)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const canSubmit = useMemo(() => form.phoneNumber.trim().length >= 10 && !submitting, [form.phoneNumber, submitting])

  async function handleSubmit(event) {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    setResult(null)

    try {
      const response = await fetch('/dev-api/sms-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })

      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload?.detail || payload?.error || 'SMS test request failed')
      }

      setResult(payload)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unknown request error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        Real delivery only works when a sender is configured in .env.local. If you turn on dry-run, the request can succeed without sending anything to your phone.
      </div>

      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm text-slate-700">
            Phone Number
            <input
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder="7705551234"
              value={form.phoneNumber}
              onChange={(event) => setForm((prev) => ({ ...prev, phoneNumber: event.target.value }))}
              required
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-slate-700">
            Carrier
            <select
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={form.carrier}
              onChange={(event) => setForm((prev) => ({ ...prev, carrier: event.target.value }))}
            >
              <option value="att">AT&amp;T</option>
              <option value="verizon">Verizon</option>
              <option value="tmobile">T-Mobile</option>
              <option value="uscellular">US Cellular</option>
              <option value="cricket">Cricket</option>
            </select>
          </label>
        </div>

        <label className="flex flex-col gap-1 text-sm text-slate-700">
          Location
          <input
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={form.location}
            onChange={(event) => setForm((prev) => ({ ...prev, location: event.target.value }))}
          />
        </label>

        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={form.dryRun}
            onChange={(event) => setForm((prev) => ({ ...prev, dryRun: event.target.checked }))}
          />
          Dry-run mode (preview only, does not send to phone)
        </label>

        <button
          type="submit"
          disabled={!canSubmit}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? 'Sending test...' : 'Send Test Message'}
        </button>
      </form>

      {error ? (
        <p className="mt-4 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
      ) : null}

      {result ? (
        <div className="mt-4 space-y-3 rounded-md bg-emerald-50 p-3 text-sm text-emerald-900">
          {result.delivery?.provider === 'dry_run' ? (
            <p className="font-medium text-amber-900">Dry-run succeeded. No message was sent to your phone.</p>
          ) : null}
          <p>
            Delivery id: <strong>{result.delivery?.id || 'n/a'}</strong>
          </p>
          <p>
            Transport: <strong>{result.delivery?.provider || 'n/a'}</strong>
          </p>
          <p>
            Destination: <strong>{result.payload?.delivery?.address || 'n/a'}</strong>
          </p>
          <details>
            <summary className="cursor-pointer">View response JSON</summary>
            <pre className="mt-2 overflow-x-auto rounded bg-slate-900 p-3 text-xs text-slate-100">
              {JSON.stringify(result, null, 2)}
            </pre>
          </details>
        </div>
      ) : null}
    </section>
  )
}
