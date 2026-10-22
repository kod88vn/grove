'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'

import { useKidSettings } from './KidSettingsProvider'
import { SolveItem } from './SolveItem'

const PROBLEMS_URL = '/homeworks/api/problems'
const START_ERROR = "Nora couldn't start that right now"

async function postItem(url, problemId) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ problemId }),
  })
  if (!response.ok) throw new Error(`Request failed: ${response.status}`)
  return response.json()
}

export function SessionRunner({ sessionId, skill, count, problemId: dailyProblemId, studentId }) {
  const { motionAllowed } = useKidSettings()
  const [problems, setProblems] = useState(null)
  const [instance, setInstance] = useState(null)
  const [position, setPosition] = useState(0)
  const [solved, setSolved] = useState(false)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [finished, setFinished] = useState(false)
  const [endSummary, setEndSummary] = useState(null)
  const [finishResult, setFinishResult] = useState(null)
  const [finishError, setFinishError] = useState('')
  const [summaryError, setSummaryError] = useState('')
  const startedFor = useRef(null)

  const itemsUrl = `/homeworks/api/sessions/${sessionId}/items`

  async function draw(problemList, nextPosition, preferredId) {
    // Boss problems are path goals: the automatic cycling never revisits one,
    // but an explicit boss problemId (the path's boss button) still resolves.
    let problem
    if (preferredId) {
      problem = problemList.find((candidate) => candidate.id === preferredId)
    } else {
      const cycling = problemList.filter((candidate) => !candidate.boss)
      const pool = cycling.length > 0 ? cycling : problemList
      problem = pool[nextPosition % pool.length]
    }
    if (!problem) throw new Error('The requested quest is not part of this skill')
    const result = await postItem(itemsUrl, problem.id)
    setInstance(result.instance)
    setPosition(nextPosition)
    setSolved(false)
  }

  async function start() {
    setLoading(true)
    setFailed(false)
    setFinished(false)
    setEndSummary(null)
    setFinishError('')
    setSummaryError('')
    setProblems(null)
    setInstance(null)
    setPosition(0)
    setSolved(false)
    setFinishResult(null)
    try {
      const response = await fetch(`${PROBLEMS_URL}?skill=${skill}`)
      if (!response.ok) throw new Error(`Request failed: ${response.status}`)
      const result = await response.json()
      if (!result.problems?.length) throw new Error('No problems found')
      setProblems(result.problems)
      await draw(result.problems, 0, dailyProblemId)
    } catch {
      setFailed(true)
    } finally {
      setLoading(false)
    }
  }

  async function nextProblem() {
    setLoading(true)
    try {
      await draw(problems, position + 1)
    } catch {
      setFailed(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const dependencies = [sessionId, skill, count, dailyProblemId]
    if (startedFor.current?.every((value, index) => value === dependencies[index])) return
    startedFor.current = dependencies
    start()
  }, [sessionId, skill, count, dailyProblemId])

  async function finishSession() {
    setFinishError('')
    setSummaryError('')
    let result
    try {
      const finishResponse = await fetch(`/homeworks/api/sessions/${sessionId}/finish`, { method: 'POST' })
      result = await finishResponse.json()
      if (!finishResponse.ok) throw new Error(result.error || `Request failed: ${finishResponse.status}`)
      setFinishResult(result)
      setFinished(true)
    } catch (cause) {
      setFinishError(cause instanceof Error ? cause.message : 'Unable to finish your session')
      return
    }

    if (studentId) {
      try {
        const now = new Date()
        const date = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-')
        const response = await fetch(`/homeworks/api/kid-experience?studentId=${encodeURIComponent(studentId)}&date=${date}`)
        const payload = await response.json()
        if (!response.ok) throw new Error(payload.error || `Request failed: ${response.status}`)
        setEndSummary(payload)
      } catch (cause) {
        setSummaryError(cause instanceof Error ? cause.message : 'Unable to load grove details')
      }
    }
  }

  if (finished) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-8">
        <div aria-label={`${finishResult.stars} stars earned`} className="flex flex-col gap-4">
          <h1 className="text-3xl font-bold text-slate-900">Great work!</h1>
          <p>You earned {finishResult.stars} stars.</p>
          {summaryError && <p role="alert">Your session is saved, but grove details couldn't load: {summaryError}</p>}
          {endSummary && <p>☀️ {endSummary.rewards.sunshine} Sunshine in your grove.</p>}
          {finishResult && <>
            <section aria-label="Skills you grew">
              <h2 className="text-xl font-bold">Skills you grew</h2>
              <ul>{(finishResult?.grew ?? []).map((tree) => <li className={motionAllowed ? 'motion-safe:animate-pulse' : ''} key={tree.skillId}>🌱 {tree.name}</li>)}</ul>
            </section>
          </>}
          {finishResult?.next && <Link href={finishResult.next.problemId
            ? `/q/${encodeURIComponent(finishResult.next.id)}/${encodeURIComponent(finishResult.next.problemId.split('/').at(-1))}`
            : `/quests?topic=${encodeURIComponent(finishResult.next.id)}`} className="w-fit rounded bg-emerald-700 px-4 py-3 font-bold text-white">Next suggestion: {finishResult.next.label}</Link>}
          <Link href="/" className="w-fit rounded bg-slate-700 px-4 py-2 text-white hover:bg-slate-800">
            Home
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      {failed ? (
        <div className="flex flex-col gap-4">
          <p>{START_ERROR}</p>
          <button type="button" onClick={start} className="w-fit rounded bg-blue-600 px-4 py-2 font-semibold text-white">
            Try again
          </button>
        </div>
      ) : loading || !instance ? (
        <p>Getting your problem ready…</p>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <p>Problem {position + 1} of {count}</p>
            <div
              role="progressbar"
              aria-valuenow={position + 1}
              aria-valuemin="1"
              aria-valuemax={count}
              className="h-3 rounded bg-slate-200"
            >
              <div className="h-3 rounded bg-blue-600" style={{ width: `${((position + 1) / count) * 100}%` }} />
            </div>
          </div>
          <SolveItem
            key={instance.seed}
            sessionId={sessionId}
            instance={instance}
            onSolved={() => setSolved(true)}
          />
          {finishError && <p role="alert">{finishError}</p>}
          {solved && position + 1 < count && (
            <button type="button" onClick={nextProblem} className="w-fit rounded bg-green-600 px-4 py-2 font-semibold text-white">
              Next
            </button>
          )}
          {solved && position + 1 >= count && (
            <button type="button" onClick={finishSession} className="min-h-14 w-fit rounded bg-green-600 px-4 py-3 font-semibold text-white">
              {finishError ? 'Retry Finish' : 'Finish'}
            </button>
          )}
        </div>
      )}
    </main>
  )
}