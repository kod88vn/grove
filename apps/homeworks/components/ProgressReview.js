'use client'

import { useState, useEffect } from 'react'

export function ProgressReview() {
  const [progress, setProgress] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadProgress()
  }, [])

  async function loadProgress() {
    try {
      const res = await fetch('/homeworks/api/progress')
      const data = await res.json()
      setProgress(data)
    } catch (error) {
      console.error('Failed to load progress:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="text-gray-600">Loading progress...</div>
  }

  if (!progress) {
    return <div className="text-gray-600">No progress data available yet.</div>
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2">
        {/* English Progress */}
        <div className="rounded border border-slate-300 bg-white p-6">
          <h3 className="mb-4 text-xl font-bold text-gray-800">📚 English Progress</h3>

          <div className="mb-4 space-y-2">
            <p className="text-sm text-gray-600">
              Exercises Completed: <span className="font-semibold">{progress.english.completed}</span>
            </p>
            <p className="text-sm text-gray-600">
              Average Score:{' '}
              <span className="font-semibold">{progress.english.averageScore}%</span>
            </p>
          </div>

          {progress.english.averageScore > 0 && (
            <div className="mb-4">
              <div className="h-3 rounded-full bg-gray-200">
                <div
                  className="h-full rounded-full bg-blue-600 transition-all"
                  style={{ width: `${progress.english.averageScore}%` }}
                />
              </div>
            </div>
          )}

          {progress.english.recentSubmissions.length > 0 && (
            <div className="space-y-2">
              <p className="font-semibold text-gray-700">Recent:</p>
              {progress.english.recentSubmissions.slice(0, 3).map((submission) => (
                <div
                  key={submission.id}
                  className="flex items-center justify-between rounded bg-slate-50 px-3 py-2 text-sm"
                >
                  <span className="text-gray-600">
                    {new Date(submission.date).toLocaleDateString()}
                  </span>
                  <span className="font-semibold text-gray-800">
                    {submission.percentage}%
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Math Progress */}
        <div className="rounded border border-slate-300 bg-white p-6">
          <h3 className="mb-4 text-xl font-bold text-gray-800">🔢 Math Progress</h3>

          <div className="mb-4 space-y-2">
            <p className="text-sm text-gray-600">
              Problem Sets Completed:{' '}
              <span className="font-semibold">{progress.math.completed}</span>
            </p>
            <p className="text-sm text-gray-600">
              Average Score: <span className="font-semibold">{progress.math.averageScore}%</span>
            </p>
          </div>

          {progress.math.averageScore > 0 && (
            <div className="mb-4">
              <div className="h-3 rounded-full bg-gray-200">
                <div
                  className="h-full rounded-full bg-green-600 transition-all"
                  style={{ width: `${progress.math.averageScore}%` }}
                />
              </div>
            </div>
          )}

          {progress.math.recentSubmissions.length > 0 && (
            <div className="space-y-2">
              <p className="font-semibold text-gray-700">Recent:</p>
              {progress.math.recentSubmissions.slice(0, 3).map((submission) => (
                <div
                  key={submission.id}
                  className="flex items-center justify-between rounded bg-slate-50 px-3 py-2 text-sm"
                >
                  <span className="text-gray-600">
                    {new Date(submission.date).toLocaleDateString()}
                  </span>
                  <span className="font-semibold text-gray-800">
                    {submission.percentage}%
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
