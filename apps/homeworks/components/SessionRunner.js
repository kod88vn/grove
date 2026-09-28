'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

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

export function SessionRunner({ sessionId, skill, count }) {
  const [problems, setProblems] = useState(null)
  const [instance, setInstance] = useState(null)
  const [position, setPosition] = useState(0)
  const [solved, setSolved] = useState(false)
  const [totalStars, setTotalStars] = useState(0)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [finished, setFinished] = useState(false)

  const itemsUrl = `/homeworks/api/sessions/${sessionId}/items`

  async function draw(problemList, nextPosition) {
    const problem = problemList[nextPosition % problemList.length]
    const result = await postItem(itemsUrl, problem.id)
    setInstance(result.instance)
    setPosition(nextPosition)
    setSolved(false)
  }

  async function start() {
    setLoading(true)
    setFailed(false)
    setFinished(false)
    setProblems(null)
    setInstance(null)
    setPosition(0)
    setSolved(false)
    setTotalStars(0)
    try {
      const response = await fetch(`${PROBLEMS_URL}?skill=${skill}`)
      if (!response.ok) throw new Error(`Request failed: ${response.status}`)
      const result = await response.json()
      if (!result.problems?.length) throw new Error('No problems found')
      setProblems(result.problems)
      await draw(result.problems, 0)
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
    start()
  }, [sessionId, skill, count])

  if (finished) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-8">
        <div aria-label={`${totalStars} stars earned`} className="flex flex-col gap-4">
          <h1 className="text-3xl font-bold text-slate-900">Great work!</h1>
          <p>You earned {totalStars} stars.</p>
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
            onSolved={(attempt) => {
              setTotalStars((stars) => stars + attempt.stars)
              setSolved(true)
            }}
          />
          {solved && position + 1 < count && (
            <button type="button" onClick={nextProblem} className="w-fit rounded bg-green-600 px-4 py-2 font-semibold text-white">
              Next
            </button>
          )}
          {solved && position + 1 >= count && (
            <button type="button" onClick={() => setFinished(true)} className="w-fit rounded bg-green-600 px-4 py-2 font-semibold text-white">
              Finish
            </button>
          )}
        </div>
      )}
    </main>
  )
}