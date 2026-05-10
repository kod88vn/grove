'use client'

import { useState } from 'react'

export function MathExercise({ onSubmit, loading }) {
  const [exercise, setExercise] = useState(null)
  const [loading_, setLoading_] = useState(false)
  const [submitted, setSubmitted] = useState(null)
  const [answers, setAnswers] = useState({})
  const [work, setWork] = useState({})

  async function loadExercise() {
    setLoading_(true)
    try {
      const res = await fetch('/homeworks/api/exercises?subject=math&type=mixed')
      const data = await res.json()
      setExercise(data.exercise)
      setAnswers({})
      setWork({})
      setSubmitted(null)
    } catch (error) {
      alert('Failed to load exercise: ' + error.message)
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
            problems: exercise.problems?.map((p) => ({
              id: p.id,
              answer: answers[p.id],
              work: work[p.id],
            })),
          },
        }),
      })
      const result = await res.json()
      setSubmitted(result)
      onSubmit?.(result)
    } catch (error) {
      alert('Failed to submit: ' + error.message)
    } finally {
      setLoading_(false)
    }
  }

  if (!exercise) {
    return (
      <div className="space-y-4">
        <button
          onClick={loadExercise}
          disabled={loading_}
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
            {submitted.gradeResult.problems.map((p, idx) => (
              <div
                key={p.id}
                className={`rounded p-3 ${
                  p.correct ? 'border-green-300 bg-green-50' : 'border-red-300 bg-red-50'
                } border`}
              >
                <p className="font-medium text-gray-800">
                  Problem {idx + 1}: {p.correct ? '✓ Correct' : '✗ Incorrect'}
                </p>
                {p.workShown === false && (
                  <p className="mt-1 text-sm text-orange-700">
                    Please show your work next time!
                  </p>
                )}
                <p className="mt-1 text-sm text-gray-600">{p.feedback}</p>
              </div>
            ))}
          </div>
        )}

        <button
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

          <p className="mb-6 rounded bg-blue-50 p-3 text-gray-800">{problem.problem}</p>

          {problem.operations && (
            <div className="mb-6 rounded bg-yellow-50 p-3">
              <p className="mb-2 font-medium text-gray-700">Steps to solve:</p>
              <ol className="ml-4 space-y-1 list-decimal text-sm text-gray-600">
                {problem.operations.map((op, i) => (
                  <li key={i}>{op}</li>
                ))}
              </ol>
            </div>
          )}

          <div className="mb-4">
            <label className="block font-medium text-gray-800">Show your work:</label>
            <textarea
              value={work[problem.id] || ''}
              onChange={(e) =>
                setWork({ ...work, [problem.id]: e.target.value })
              }
              placeholder="Write down your steps here..."
              rows={4}
              className="mt-2 w-full rounded border border-slate-300 p-2 text-sm font-mono"
            />
          </div>

          <div className="mb-4">
            <label className="block font-medium text-gray-800">Your answer:</label>
            <input
              type="text"
              value={answers[problem.id] || ''}
              onChange={(e) =>
                setAnswers({ ...answers, [problem.id]: e.target.value })
              }
              placeholder="Enter your final answer"
              className="mt-2 w-full rounded border border-slate-300 px-3 py-2"
            />
          </div>
        </div>
      ))}

      <button
        type="submit"
        disabled={loading_}
        className="rounded bg-green-600 px-6 py-2 text-white hover:bg-green-700 disabled:bg-gray-400"
      >
        {loading_ ? 'Grading...' : 'Submit Problems'}
      </button>
    </form>
  )
}
