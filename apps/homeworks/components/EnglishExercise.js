'use client'

import { useState } from 'react'

export function EnglishExercise({ onSubmit, loading }) {
  const [exercise, setExercise] = useState(null)
  const [loading_, setLoading_] = useState(false)
  const [submitted, setSubmitted] = useState(null)
  const [answers, setAnswers] = useState({})

  async function loadExercise() {
    setLoading_(true)
    try {
      const res = await fetch('/homeworks/api/exercises?subject=english&type=reading')
      const data = await res.json()
      setExercise(data.exercise)
      setAnswers({})
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
          subject: 'english',
          type: 'reading',
          exercise,
          answers,
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
          {loading_ ? 'Loading...' : 'Start Reading Exercise'}
        </button>
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="space-y-6 rounded border border-green-300 bg-green-50 p-6">
        <div>
          <h3 className="mb-2 text-xl font-bold text-green-800">Exercise Graded!</h3>
          <p className="mb-4 text-lg text-green-700">
            Score: {submitted.score}/{submitted.maxScore} ({submitted.percentage}%)
          </p>
          <p className="mb-4 whitespace-pre-line text-gray-700">{submitted.feedback}</p>
        </div>

        {submitted.gradeResult?.answers && (
          <div className="space-y-3">
            <h4 className="font-semibold text-gray-800">Answer Review:</h4>
            {submitted.gradeResult.answers.map((item) => (
              <div key={item.id} className="rounded bg-white p-3">
                <p className="font-medium text-gray-800">
                  Q{item.id}: {item.score}/{item.score + 1} points
                </p>
                <p className="mt-1 text-sm text-gray-600">{item.feedback}</p>
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
          Try Another Exercise
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="rounded border border-slate-300 bg-white p-6">
        <h3 className="mb-4 text-lg font-semibold text-gray-800">Reading Passage</h3>
        <p className="whitespace-pre-line leading-relaxed text-gray-700">
          {exercise.passage}
        </p>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-800">Comprehension Questions</h3>
        {exercise.questions?.map((q) => (
          <div key={q.id} className="rounded border border-slate-200 bg-slate-50 p-4">
            <label className="block font-medium text-gray-800">{q.question}</label>

            {q.type === 'multiple-choice' ? (
              <div className="mt-3 space-y-2">
                {q.options?.map((option, idx) => (
                  <label key={idx} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name={`q-${q.id}`}
                      value={option}
                      checked={answers[q.id] === option}
                      onChange={(e) =>
                        setAnswers({ ...answers, [q.id]: e.target.value })
                      }
                      className="h-4 w-4"
                    />
                    <span className="text-gray-700">{option}</span>
                  </label>
                ))}
              </div>
            ) : (
              <textarea
                value={answers[q.id] || ''}
                onChange={(e) =>
                  setAnswers({ ...answers, [q.id]: e.target.value })
                }
                placeholder="Type your answer here..."
                rows={3}
                className="mt-3 w-full rounded border border-slate-300 p-2"
              />
            )}
          </div>
        ))}
      </div>

      <button
        type="submit"
        disabled={loading_}
        className="rounded bg-green-600 px-6 py-2 text-white hover:bg-green-700 disabled:bg-gray-400"
      >
        {loading_ ? 'Grading...' : 'Submit Answers'}
      </button>
    </form>
  )
}
