'use client'

import { useState } from 'react'

function draftFilename(draft) {
  return `${draft.skillId.replaceAll('.', '-')}-${draft.id}.json`
}

export function ContentReviewForm({ drafts }) {
  const [reviewer, setReviewer] = useState('')
  const [pending, setPending] = useState(drafts)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  async function decide(draft, approved) {
    setBusy(true)
    setMessage('')
    try {
      const response = await fetch('/homeworks/api/content-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: draftFilename(draft), reviewer, approved }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || `Review request failed (${response.status})`)
      setPending((current) => current.filter((item) => item.id !== draft.id))
      setMessage(`${approved ? 'Approved' : 'Rejected'} ${draft.id} as ${result.reviewer}.`)
    } catch (error) {
      setMessage(error.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section aria-label="Pending English drafts">
      <label className="mb-4 block font-medium" htmlFor="reviewer-name">Reviewer</label>
      <input id="reviewer-name" className="mb-6 rounded border p-2" value={reviewer} onChange={(event) => setReviewer(event.target.value)} />
      <p role="status" aria-live="polite">{message}</p>
      {pending.length === 0 ? <p>No pending drafts.</p> : pending.map((draft) => (
        <article className="mb-4 rounded border p-4" key={draft.id}>
          <h2 className="font-semibold">{draft.id} · Grade {draft.grade}</h2>
          <p className="text-sm text-amber-800">Pending human review · {draft.reviewedBy}</p>
          <p className="my-2">{draft.passage || draft.sentence} Answer: {draft.answer}</p>
          <button className="mr-2 rounded bg-green-700 px-3 py-2 text-white" disabled={busy || !reviewer.trim()} onClick={() => decide(draft, true)}>Approve</button>
          <button className="rounded border px-3 py-2" disabled={busy || !reviewer.trim()} onClick={() => decide(draft, false)}>Reject</button>
        </article>
      ))}
    </section>
  )
}