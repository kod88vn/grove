'use client'

import { useState } from 'react'

const PLACE_LABELS = ['O', 'T', 'H', 'Th', 'TTh', 'HTh']

function getMaxLen(problem) {
  if (problem.problemType !== 'column-method' || !Array.isArray(problem.operands)) return 0
  return Math.max(
    String(problem.expectedAnswer || '').length,
    ...problem.operands.map((operand) => String(operand).length)
  )
}

function assembleColumnAnswer(problem, digitsByCol) {
  const maxLen = getMaxLen(problem)
  if (!maxLen) return ''

  const raw = Array.from({ length: maxLen }, (_, i) => digitsByCol?.[i] || '').join('')
  const trimmed = raw.replace(/^0+/, '')
  return trimmed || (raw ? '0' : '')
}

function ColumnMethodGrid({ problem, digitsByCol, carriesByCol, onDigitChange, onCarryChange }) {
  const operands = Array.isArray(problem.operands) ? problem.operands : []
  if (operands.length === 0) return null

  const maxLen = Math.max(
    String(problem.expectedAnswer || '').length,
    ...operands.map((operand) => String(operand).length)
  )
  const labels = PLACE_LABELS.slice(0, maxLen).reverse()
  const paddedOperands = operands.map((operand) => String(operand).padStart(maxLen, ' '))

  return (
    <div className="inline-block min-w-max font-mono">
      <div className="flex flex-col items-end">
        <div className="mb-1 ml-7 flex">
          {labels.map((label, i) => (
            <div
              key={i}
              className="w-10 text-center text-xs font-sans font-semibold uppercase tracking-wide text-slate-400"
            >
              {label}
            </div>
          ))}
        </div>

        <div className="mb-0.5 ml-7 flex">
          {Array.from({ length: maxLen }).map((_, i) => (
            <input
              key={i}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={carriesByCol?.[i] || ''}
              onChange={(e) => onCarryChange(i, e.target.value.replace(/[^0-9]/g, '').slice(-1))}
              className="h-5 w-10 rounded border border-dashed border-amber-300 bg-amber-50 text-center text-xs text-amber-700 focus:border-amber-500 focus:outline-none"
              aria-label={`Carry ${labels[i]}`}
            />
          ))}
        </div>
        <div className="mb-1 ml-7 pr-1 text-right text-xs text-amber-500">carry row</div>

        {paddedOperands.map((operand, rowIndex) => (
          <div key={rowIndex} className="flex items-center">
            <span className="w-7 pr-1 text-right text-lg font-bold text-gray-700">
              {rowIndex === paddedOperands.length - 1 ? problem.operator || '+' : ''}
            </span>
            {operand.split('').map((char, colIndex) => (
              <div
                key={colIndex}
                className="flex h-10 w-10 items-center justify-center text-lg text-gray-800"
              >
                {char.trim() || ''}
              </div>
            ))}
          </div>
        ))}

        <div className="mb-1 ml-7 w-full border-t-2 border-gray-700" />

        <div className="ml-7 flex">
          {Array.from({ length: maxLen }).map((_, i) => (
            <input
              key={i}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digitsByCol?.[i] || ''}
              onChange={(e) => onDigitChange(i, e.target.value.replace(/[^0-9]/g, '').slice(-1))}
              required
              className="h-10 w-10 rounded-sm border-2 border-blue-400 bg-blue-50 text-center text-lg focus:border-blue-600 focus:bg-white focus:outline-none"
              aria-label={`Answer digit ${labels[i]}`}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

export function MathExercise({ onSubmit, loading }) {
  const [exercise, setExercise] = useState(null)
  const [loading_, setLoading_] = useState(false)
  const [submitted, setSubmitted] = useState(null)
  const [answers, setAnswers] = useState({})
  const [work, setWork] = useState({})
  const [columnDigits, setColumnDigits] = useState({})
  const [carries, setCarries] = useState({})

  async function loadExercise() {
    setLoading_(true)
    try {
      const res = await fetch('/homeworks/api/exercises?subject=math&type=mixed')
      const data = await res.json()
      setExercise(data.exercise)
      setAnswers({})
      setWork({})
      setColumnDigits({})
      setCarries({})
      setSubmitted(null)
    } catch (error) {
      console.log('Failed to load exercise: ' + error.message)
    } finally {
      setLoading_(false)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!exercise) return

    setLoading_(true)
    try {
      const res = await fetch('/homeworks/api/grade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: 'math',
          type: 'mixed',
          exercise,
          answers: {
            problems: exercise.problems?.map((problem) => ({
              id: problem.id,
              answer:
                problem.problemType === 'column-method'
                  ? assembleColumnAnswer(problem, columnDigits[problem.id] || {})
                  : answers[problem.id],
              work:
                problem.problemType === 'column-method'
                  ? JSON.stringify({
                      digits: columnDigits[problem.id] || {},
                      carries: carries[problem.id] || {},
                    })
                  : work[problem.id],
            })),
          },
        }),
      })

      const result = await res.json()
      setSubmitted(result)
      onSubmit?.(result)
    } catch (error) {
      console.log('Failed to submit: ' + error.message)
    } finally {
      setLoading_(false)
    }
  }

  if (!exercise) {
    return (
      <div className="space-y-4">
        <button
          onClick={loadExercise}
          disabled={loading_ || loading}
          className="rounded bg-blue-600 px-6 py-2 text-white hover:bg-blue-700 disabled:bg-gray-400"
        >
          {loading_ ? 'Loading...' : 'Start Math Problems'}
        </button>
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="space-y-6 rounded border border-green-300 bg-green-50 p-6">
        <div>
          <h3 className="mb-2 text-xl font-bold text-green-800">Problems Graded!</h3>
          <p className="mb-4 text-lg text-green-700">
            Correct: {submitted.gradeResult.totalCorrect}/{submitted.gradeResult.totalProblems}
          </p>
          <p className="mb-4 text-gray-700">{submitted.gradeResult.comment}</p>
        </div>

        {submitted.gradeResult?.problems && (
          <div className="space-y-4">
            <h4 className="font-semibold text-gray-800">Problem Feedback:</h4>
            {submitted.gradeResult.problems.map((problem, idx) => (
              <div
                key={problem.id}
                className={`rounded border p-3 ${
                  problem.correct ? 'border-green-300 bg-green-50' : 'border-red-300 bg-red-50'
                }`}
              >
                <p className="font-medium text-gray-800">
                  Problem {idx + 1}: {problem.correct ? '✓ Correct' : '✗ Incorrect'}
                </p>
                {problem.workShown === false && (
                  <p className="mt-1 text-sm text-orange-700">Please show your work next time!</p>
                )}
                <p className="mt-1 text-sm text-gray-600">{problem.feedback}</p>
              </div>
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={() => setSubmitted(null)}
          className="rounded bg-amber-600 px-4 py-2 text-white hover:bg-amber-700"
        >
          Revise and Resubmit
        </button>

        <button
          type="button"
          onClick={() => {
            setExercise(null)
            setSubmitted(null)
          }}
          className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
        >
          Try Another Problem Set
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {exercise.problems?.map((problem, idx) => (
        <div key={problem.id} className="rounded border border-slate-300 bg-white p-6">
          <h4 className="mb-4 text-lg font-semibold text-gray-800">Problem {idx + 1}</h4>
          <p className="mb-4 rounded bg-blue-50 p-3 text-gray-800">{problem.problem}</p>

          {problem.problemType === 'column-method' ? (
            <div className="mb-4 overflow-x-auto rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-600">
                Column Method: fill each digit box
              </p>
              <ColumnMethodGrid
                problem={problem}
                digitsByCol={columnDigits[problem.id] || {}}
                carriesByCol={carries[problem.id] || {}}
                onDigitChange={(col, value) =>
                  setColumnDigits((prev) => ({
                    ...prev,
                    [problem.id]: {
                      ...(prev[problem.id] || {}),
                      [col]: value,
                    },
                  }))
                }
                onCarryChange={(col, value) =>
                  setCarries((prev) => ({
                    ...prev,
                    [problem.id]: {
                      ...(prev[problem.id] || {}),
                      [col]: value,
                    },
                  }))
                }
              />
            </div>
          ) : (
            <>
              <div className="mb-4">
                <label className="block font-medium text-gray-800">Show your work:</label>
                <textarea
                  value={work[problem.id] || ''}
                  onChange={(e) => setWork({ ...work, [problem.id]: e.target.value })}
                  placeholder="Write down your steps here..."
                  rows={3}
                  className="mt-2 w-full rounded border border-slate-300 p-2 text-sm font-mono"
                />
              </div>
              <div className="mb-4">
                <label className="block font-medium text-gray-800">Your answer:</label>
                <input
                  type="text"
                  value={answers[problem.id] || ''}
                  onChange={(e) => setAnswers({ ...answers, [problem.id]: e.target.value })}
                  placeholder="Enter your final answer"
                  required
                  className="mt-2 w-full rounded border border-slate-300 px-3 py-2"
                />
              </div>
            </>
          )}
        </div>
      ))}

      <button
        type="submit"
        disabled={loading_ || loading}
        className="rounded bg-green-600 px-6 py-2 text-white hover:bg-green-700 disabled:bg-gray-400"
      >
        {loading_ ? 'Grading...' : 'Submit Problems'}
      </button>
    </form>
  )
}
