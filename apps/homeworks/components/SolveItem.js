'use client'

import { useRef, useState } from 'react'

import { useKidSettings } from './KidSettingsProvider'
import { MathKeypad } from './MathKeypad'
import { ReadAloudButton } from './ReadAloudButton'
import { getAudioContext, playFeedbackTone } from '../lib/feedbackSound'
import { AnswerWidget } from './widgets/AnswerWidget'
import { emptyValue, toResponse } from './widgets/response'

const ATTEMPTS_URL = '/homeworks/api/attempts'
const HINTS_URL = '/homeworks/api/hints'
const RETRY_MESSAGE = "Nora couldn't check that right now"

async function postJson(url, body) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!response.ok) {
    const error = new Error(`Request failed: ${response.status}`)
    error.status = response.status
    throw error
  }
  return response.json()
}

export function SolveItem({ sessionId, instance, onSolved }) {
  const mountedAt = useRef(Date.now())
  const checkInFlight = useRef(false)
  const hintInFlight = useRef(false)
  const audioContext = useRef(null)
  const [value, setValue] = useState(() => emptyValue(instance))
  const [attempt, setAttempt] = useState(null)
  const [verdictSeq, setVerdictSeq] = useState(0)
  const [error, setError] = useState(null)
  const [hints, setHints] = useState([])
  const [hintsUsed, setHintsUsed] = useState(null)
  const [hintsExhausted, setHintsExhausted] = useState(false)
  const { motionAllowed, soundsAllowed } = useKidSettings()
  const solved = attempt?.correct === true

  async function checkAnswer() {
    if (checkInFlight.current) return
    checkInFlight.current = true
    setError(null)
    try {
      const result = await postJson(ATTEMPTS_URL, {
        sessionId,
        problemId: instance.problemId,
        seed: instance.seed,
        response: toResponse(instance, value),
        durationMs: Math.max(0, Math.round(Date.now() - mountedAt.current)),
      })
      setAttempt(result)
      setVerdictSeq((sequence) => sequence + 1)
      if (soundsAllowed) {
        try {
          if (!audioContext.current) audioContext.current = getAudioContext()
          if (audioContext.current) playFeedbackTone(audioContext.current, result.correct)
        } catch {
          // Losing a sound must not lose the verdict.
        }
      }
      if (result.correct) onSolved?.(result)
    } catch {
      setAttempt(null)
      setError(RETRY_MESSAGE)
    } finally {
      checkInFlight.current = false
    }
  }

  async function requestHint() {
    if (hintInFlight.current) return
    hintInFlight.current = true
    setError(null)
    try {
      const result = await postJson(HINTS_URL, {
        sessionId,
        problemId: instance.problemId,
        seed: instance.seed,
      })
      setHints((shown) => [...shown, result.hint])
      setHintsUsed(result.hintsUsed)
    } catch (requestError) {
      if (requestError.status === 409) {
        setHintsExhausted(true)
        setError('No more hints')
      } else {
        setError(RETRY_MESSAGE)
      }
    } finally {
      hintInFlight.current = false
    }
  }

  return (
    <section className="flex flex-col gap-4">
      <AnswerWidget instance={instance} value={value} onChange={setValue} disabled={solved} />
      <MathKeypad widget={instance.widget} value={value} onChange={setValue} disabled={solved} />

      <div className="flex flex-wrap gap-3">
        <ReadAloudButton text={instance.prompt} />
        <button
          type="button"
          onClick={requestHint}
          disabled={solved || hintsExhausted}
          className="rounded bg-amber-100 px-4 py-2 font-semibold text-amber-900 disabled:opacity-50"
        >
          💡 Hint
        </button>
        <button
          type="button"
          onClick={checkAnswer}
          disabled={solved}
          className="rounded bg-blue-600 px-4 py-2 font-semibold text-white disabled:opacity-50"
        >
          Check ✅
        </button>
      </div>

      {hintsUsed !== null && <div>Hints used: {hintsUsed}</div>}
      {hints.map((hint, index) => <div key={`${hint}-${index}`}>{hint}</div>)}
      {error && <div>{error}</div>}
      {attempt && (
        <div
          key={`verdict-${verdictSeq}`}
          data-testid="verdict"
          {...(motionAllowed ? { 'data-animate': attempt.correct ? 'correct' : 'wrong' } : {})}
        >
          {attempt.feedback}
        </div>
      )}
      {attempt?.correct === true && (
        <div
          key={`stars-${verdictSeq}`}
          aria-label={`${attempt.stars} of 3 stars`}
          {...(motionAllowed ? { 'data-animate': 'stars' } : {})}
        >
          {'⭐'.repeat(attempt.stars)}
        </div>
      )}
      {solved && (
        <div>
          <h2>How Nora solved it</h2>
          <div>{attempt.explanation}</div>
        </div>
      )}
    </section>
  )
}
