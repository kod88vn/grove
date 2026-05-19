'use client'

import { useState, useEffect } from 'react'

export function ParentView() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [selectedReadingId, setSelectedReadingId] = useState(null)
  const [selectedReading, setSelectedReading] = useState(null)

  async function loadData() {
    setLoading(true)
    try {
      const res = await fetch('/homeworks/api/parent')
      const json = await res.json()
      if (!json.error) {
        setData(json)
      }
    } catch (e) {
      console.error('Failed to load parent data:', e)
    } finally {
      setLoading(false)
    }
  }

  async function loadReadingDetail(readingId) {
    try {
      const res = await fetch(`/homeworks/api/reading-history/${readingId}`)
      if (!res.ok) return null
      const json = await res.json()
      return json
    } catch {
      return null
    }
  }

  function selectReading(readingId) {
    setSelectedReadingId(readingId)
    loadReadingDetail(readingId).then((detail) => {
      if (detail) setSelectedReading(detail)
    })
  }

  useEffect(() => { loadData() }, [])

  if (loading) return <div className="text-gray-600">Loading parent dashboard...</div>
  if (!data) return <div className="text-red-600">Failed to load parent dashboard.</div>

  const { allSubmissions, englishSummary, mathSummary, readingHistory } = data

  // Aggregate scores
  const avgScore = (arr) => {
    if (!arr?.length) return 0
    return Math.round(arr.reduce((s, i) => s + (i.percentage || 0), 0) / arr.length)
  }

  function formatRelative(dateStr) {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    const days = Math.floor(hrs / 24)
    return `${days}d ago`
  }

  function getDomainLabel(domainId) {
    const labels = {
      random: '🎲 Random',
      science: '🔬 Science',
      history: '📜 History',
      nature: '🌿 Nature & Animals',
      'space exploration': '🚀 Space Exploration',
      'marine life': '🐋 Marine Life',
      'environmental care': '🌍 Environmental Care',
      engineering: '⚙️ Engineering',
      'technology and coding': '💻 Technology & Coding',
      geography: '🗺️ Geography',
      'food and nutrition': '🍎 Food & Nutrition',
      'sports and health': '🏃 Sports & Health',
      'community helpers': '👷 Community Helpers',
      'art and design': '🎨 Art & Design',
      music: '🎵 Music',
      architecture: '🏛️ Architecture',
      'transportation systems': '🚂 Transportation Systems',
      'math in daily life': '📐 Math in Daily Life',
    }
    return labels[domainId] || domainId || '🎲 Random'
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">👨‍👩‍👧 Parent Dashboard</h2>
        <p className="text-sm text-gray-500 mt-1">Overview of your child's homework activity and reading progress.</p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* English */}
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <h3 className="text-lg font-semibold text-gray-800 mb-2">📚 English</h3>
          <p className="text-sm text-gray-600">Exercises: {englishSummary.completed?.length || 0}</p>
          <p className="text-sm text-gray-600">Avg Score: {avgScore(englishSummary.completed || [])}%</p>
          <div className="mt-2 h-2 rounded-full bg-gray-200">
            <div className="h-full rounded-full bg-blue-600" style={{ width: `${avgScore(englishSummary.completed || [])}%` }} />
          </div>
        </div>

        {/* Math */}
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <h3 className="text-lg font-semibold text-gray-800 mb-2">🔢 Math</h3>
          <p className="text-sm text-gray-600">Exercises: {mathSummary.completed?.length || 0}</p>
          <p className="text-sm text-gray-600">Avg Score: {avgScore(mathSummary.completed || [])}%</p>
          <div className="mt-2 h-2 rounded-full bg-gray-200">
            <div className="h-full rounded-full bg-green-600" style={{ width: `${avgScore(mathSummary.completed || [])}%` }} />
          </div>
        </div>

        {/* Reading */}
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <h3 className="text-lg font-semibold text-gray-800 mb-2">📖 Reading</h3>
          <p className="text-sm text-gray-600">Readings Completed: {readingHistory.length}</p>
          <p className="text-sm text-gray-600">Avg Score: {avgScore(readingHistory.filter((r) => r.percentage !== null))}%</p>
          <div className="mt-2 h-2 rounded-full bg-gray-200">
            <div className="h-full rounded-full bg-purple-600" style={{ width: `${avgScore(readingHistory.filter((r) => r.percentage !== null))}%` }} />
          </div>
        </div>
      </div>

      {/* Reading History Section */}
      <div>
        <h3 className="text-xl font-semibold text-gray-800 mb-4">📖 Reading History & Lessons</h3>

        {/* Reading detail view */}
        {selectedReading && (
          <div className="mb-4 rounded-lg border border-purple-300 bg-purple-50 p-6">
            <div className="flex items-start justify-between mb-3">
              <h4 className="font-bold text-gray-900">{selectedReading.lessonKeyPoint}</h4>
              <button onClick={() => setSelectedReading(null)} className="text-gray-500 hover:text-gray-700">✕</button>
            </div>
            <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium mb-3 ${selectedReading.domain === 'random' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
              {getDomainLabel(selectedReading.domain)}
            </span>

            {/* Passage */}
            <div className="mb-4">
              <h5 className="text-sm font-semibold text-gray-700 mb-1">Passage:</h5>
              <p className="whitespace-pre-line text-gray-700 leading-relaxed">{selectedReading.passage}</p>
            </div>

            {/* Questions */}
            {selectedReading.questions?.length > 0 && (
              <div className="mb-4">
                <h5 className="text-sm font-semibold text-gray-700 mb-1">Questions:</h5>
                <div className="space-y-2">
                  {selectedReading.questions.map((q) => (
                    <div key={q.id} className="bg-white rounded p-3">
                      <p className="font-medium text-gray-800">Q{q.id}: {q.question}</p>
                      <p className="text-sm text-gray-600 mt-1">✅ Correct answer: {q.correctAnswer}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selectedReading.percentage !== null && (
              <span className={`rounded-full px-3 py-1 text-sm font-semibold ${selectedReading.percentage >= 80 ? 'bg-green-100 text-green-700' : selectedReading.percentage >= 60 ? 'bg-yellow-100 text-yellow-700' : selectedReading.percentage > 0 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>
                Score: {selectedReading.percentage}%
              </span>
            )}
          </div>
        )}

        {readingHistory.length === 0 ? (
          <p className="text-gray-500">No reading history yet. Submissions will appear here as your child completes exercises.</p>
        ) : (
          <div className="space-y-3">
            {readingHistory.map((reading) => (
              <div key={reading.id} className="rounded-lg border border-slate-200 bg-white p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-medium text-gray-800">{reading.lessonKeyPoint}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`rounded px-2 py-0.5 text-xs font-medium ${reading.domain === 'random' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                        {getDomainLabel(reading.domain)}
                      </span>
                      <span className="text-xs text-gray-500">{formatRelative(reading.date)}</span>
                    </div>
                  </div>
                  {reading.percentage !== null && (
                    <span className={`rounded-full px-3 py-1 text-sm font-semibold ${reading.percentage >= 80 ? 'bg-green-100 text-green-700' : reading.percentage >= 60 ? 'bg-yellow-100 text-yellow-700' : reading.percentage > 0 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>
                      {reading.percentage}%
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-600 line-clamp-2">{reading.passage}</p>
                <button type="button" onClick={() => selectReading(reading.id)} className="mt-2 text-sm text-blue-600 hover:underline">
                  View full reading & questions →
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Submissions */}
      <div>
        <h3 className="text-xl font-semibold text-gray-800 mb-4">📝 Recent Submissions</h3>

        {allSubmissions.length === 0 ? (
          <p className="text-gray-500">No submissions yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Date</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Subject</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Type</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Score</th>
                </tr>
              </thead>
              <tbody>
                {allSubmissions.map((sub) => (
                  <tr key={sub.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3 text-gray-600">{formatRelative(sub.date)}</td>
                    <td className="px-4 py-3 font-medium text-gray-800 capitalize">{sub.type === 'mixed' ? 'Math' : sub.subject}</td>
                    <td className="px-4 py-3 text-gray-600 capitalize">{sub.type === 'mixed' ? 'Problem Set' : sub.type}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${sub.percentage >= 80 ? 'bg-green-100 text-green-700' : sub.percentage >= 60 ? 'bg-yellow-100 text-yellow-700' : sub.percentage > 0 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>
                        {sub.percentage}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Refresh button */}
      <button onClick={loadData} className="rounded bg-slate-600 px-4 py-2 text-white hover:bg-slate-700">
        🔄 Refresh Data
      </button>
    </div>
  )
}