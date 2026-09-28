'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'

import { localDateOf } from '@/lib/localDay'

import { SolveItem } from './SolveItem'

const SESSIONS_URL = '/homeworks/api/sessions'
const START_ERROR = "Nora couldn't start that right now"

async function postJson(url, body) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!response.ok) throw new Error(`Request failed: ${response.status}`)
  return response.json()
}

export function SoloPractice({ skill, template }) {
  const [sessionId, setSessionId] = useState(null)
  const [instance, setInstance] = useState(null)
  const [solved, setSolved] = useState(false)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const startedFor = useRef(null)

  async function drawItem(activeSessionId) {
    const result = await postJson(`${SESSIONS_URL}/${activeSessionId}/items`, {
      problemId: `${skill}/${template}`,
    })
    setSessionId(activeSessionId)
    setInstance(result.instance)
    setSolved(false)
  }

  async function startSession() {
    setLoading(true)
    setFailed(false)
    setInstance(null)
    setSolved(false)
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
      const session = await postJson(SESSIONS_URL, {
        studentId: 'public',
        kind: 'skill',
        skillId: skill,
        localDate: localDateOf(new Date(), tz),
        tz,
      })
      await drawItem(session.sessionId)
    } catch {
      setFailed(true)
    } finally {
      setLoading(false)
    }
  }

  async function tryAnother() {
    setLoading(true)
    setInstance(null)
    try {
      await drawItem(sessionId)
    } catch {
      setFailed(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const dependencies = [skill, template]
    if (startedFor.current?.every((value, index) => value === dependencies[index])) return
    startedFor.current = dependencies
    startSession()
  }, [skill, template])

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-slate-900">Solo practice</h1>
        <Link href="/" className="rounded bg-slate-700 px-4 py-2 text-white hover:bg-slate-800">
          Home
        </Link>
      </div>

      {failed ? (
        <div className="flex flex-col gap-4">
          <p>{START_ERROR}</p>
          <button type="button" onClick={startSession} className="w-fit rounded bg-blue-600 px-4 py-2 font-semibold text-white">
            Try again
          </button>
        </div>
      ) : loading ? (
        <p>Getting your problem ready…</p>
      ) : (
        <div className="flex flex-col gap-4">
          <SolveItem
            key={instance.seed}
            sessionId={sessionId}
            instance={instance}
            onSolved={() => setSolved(true)}
          />
          {solved && (
            <button type="button" onClick={tryAnother} className="w-fit rounded bg-green-600 px-4 py-2 font-semibold text-white">
              Try another
            </button>
          )}
        </div>
      )}
    </main>
  )
}