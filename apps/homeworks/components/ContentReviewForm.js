'use client'

import { useState } from 'react'

function CandidateValue({ value }) {
  if (Array.isArray(value)) {
    return <ul className="list-disc pl-5">{value.map((item, index) => (
      <li key={index}><CandidateValue value={item} /></li>
    ))}</ul>
  }
  if (value && typeof value === 'object') {
    return <pre className="whitespace-pre-wrap">{JSON.stringify(value, null, 2)}</pre>
  }
  return <span className="whitespace-pre-wrap">{String(value)}</span>
}

export function ContentReviewForm({ drafts }) {
  const [reviewer, setReviewer] = useState('')
  const [pending, setPending] = useState(drafts)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  async function decide(entry, draft, approved) {
    setBusy(true)
    setMessage('')
    try {
      const response = await fetch('/homeworks/api/content-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: entry.filename, reviewer, approved }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || `Review request failed (${response.status})`)
      setPending((current) => current.filter((item) => item.filename !== entry.filename))
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
      {pending.length === 0 ? <p>No pending drafts.</p> : pending.map((entry, index) => {
        const draft = entry.draft || entry
        const fields = Object.entries(draft).filter(([field]) => !['id', 'grade', 'reviewedBy', 'sentence', 'answer'].includes(field))
        return (
          <article className="mb-4 rounded border p-4" key={entry.filename || index}>
            <h2 className="font-semibold">{draft.id} · Grade {draft.grade}</h2>
            <p className="text-sm text-amber-800">Pending human review · {draft.reviewedBy}</p>
            <p className="my-2">Sentence: {draft.sentence} Answer: {draft.answer}</p>
            <dl className="my-3 space-y-2">
              {fields.map(([field, value]) => (
                <div key={field}>
                  <dt className="font-medium">{field.replace(/([A-Z])/g, ' $1')}</dt>
                  <dd><CandidateValue value={value} /></dd>
                </div>
              ))}
            </dl>
            <button className="mr-2 rounded bg-green-700 px-3 py-2 text-white" disabled={busy || !reviewer.trim()} onClick={() => decide(entry, draft, true)}>Approve</button>
            <button className="rounded border px-3 py-2" disabled={busy || !reviewer.trim()} onClick={() => decide(entry, draft, false)}>Reject</button>
          </article>
        )
      })}
    </section>
  )
}