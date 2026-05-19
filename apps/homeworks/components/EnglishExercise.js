'use client'

import { useState, useEffect } from 'react'

export function EnglishExercise({ onSubmit, loading }) {
  const [exercise, setExercise] = useState(null)
  const [loading_, setLoading_] = useState(false)
  const [submitted, setSubmitted] = useState(null)
  const [answers, setAnswers] = useState({})
  const [lessonKeyPoint, setLessonKeyPoint] = useState('')
  const [selectedDomainId, setSelectedDomainId] = useState(null) // null or topic id (null = random)
  const [topics, setTopics] = useState([])
  const [categoriesMap, setCategoriesMap] = useState({})
  const [view, setView] = useState('exercise') // 'exercise' or 'history'
  const [readingHistory, setReadingHistory] = useState([])
  const [historyDetail, setHistoryDetail] = useState(null)

  async function loadTopics() {
    try {
      const res = await fetch('/chat/api/nora-homework/topics')
      const data = await res.json()
      setTopics(data.topics || [])

      const grouped = {}
      ;(data.categories || []).forEach((cat) => {
        grouped[cat] = (data.topics || []).filter((t) => t.category === cat)
      })
      setCategoriesMap(grouped)
    } catch (error) {
      console.log('Failed to load topics:', error.message)
    }
  }

  async function loadReadingHistory() {
    try {
      const res = await fetch('/homeworks/api/reading-history')
      const data = await res.json()
      setReadingHistory(data.history || [])
    } catch (error) {
      console.log('Failed to load reading history:', error.message)
    }
  }

  async function fetchReadingDetail(readingId) {
    try {
      const res = await fetch(`/homeworks/api/reading-history/${readingId}`)
      if (!res.ok) return null
      const data = await res.json()
      return data
    } catch {
      return null
    }
  }

  function getDomainLabel(domainId) {
    if (!domainId || domainId === 'random') return '🎲 Random'
    const topic = topics.find((t) => t.id === domainId)
    return topic ? topic.name : domainId
  }

  function getTopicsByCategory(cat) {
    return categoriesMap[cat] || []
  }

  function getHistorySummary(reading) {
    // Extract a short summary from the lesson key point + domain
    return `${getDomainLabel(reading.domain)} — ${reading.lessonKeyPoint}`
  }

  // --- Fetch exercise when selectedDomainId changes ---
  async function fetchExercise() {
    setLoading_(true)
    setHistoryDetail(null)

    try {
      const params = new URLSearchParams()
      params.set('subject', 'english')
      params.set('type', 'reading')
      if (selectedDomainId) {
        params.set('selectedDomain', selectedDomainId)
      }

      const res = await fetch(`/homeworks/api/exercises?${params.toString()}`)
      const data = await res.json()

      if (data.exercise || data.lessonKeyPoint) {
        setExercise(data.exercise)
        setLessonKeyPoint(data.lessonKeyPoint || '')
        setAnswers({})
        setSubmitted(null)
      } else {
        // Failed to generate exercise
        if (data.error) {
          console.error('Exercise generation failed:', data.error)
        }
      }
    } catch (error) {
      console.log('Failed to load exercise: ' + error.message)
    } finally {
      setLoading_(false)
    }
  }

  // --- Fetch saved reading from history ---
  function selectReadingFromHistory(readingId) {
    setExercise(null)
    setSelectedDomainId(null)

    fetchReadingDetail(readingId).then((detail) => {
      if (detail) {
        setExercise({ passage: detail.passage, questions: detail.questions })
        setLessonKeyPoint(detail.lessonKeyPoint || '')
        setSelectedDomainId(detail.domain ? detail.domain : null)
        setHistoryDetail(detail)
        setAnswers({})
        setSubmitted(null)
      }
    })
  }

  // --- Submit answers and save to history ---
  async function handleSubmit(e) {
    e.preventDefault()
    if (!exercise) return

    setLoading_(true)
    const domainForHistory = selectedDomainId || 'random'

    try {
      const res = await fetch('/homeworks/api/grade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject: 'english', type: 'reading', exercise, answers }),
      })

      const result = await res.json()
      setSubmitted(result)

      // Save to reading history
      try {
        await fetch('/homeworks/api/reading-history', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            passage: exercise.passage,
            questions: exercise.questions,
            lessonKeyPoint,
            domain: domainForHistory,
            score: result.score || 0,
            maxScore: result.maxScore || 1,
          }),
        })
      } catch (saveErr) {
        console.log('Failed to save reading:', saveErr.message)
      }

      onSubmit?.(result)
    } catch (error) {
      console.log('Failed to submit: ' + error.message)
    } finally {
      setLoading_(false)
    }
  }

  // --- View switching ---
  function switchToExercise() {
    setView('exercise')
    setSelectedDomainId(null)
  }

  function switchToHistory() {
    setView('history')
    loadReadingHistory()
  }

  // --- Effects ---
  useEffect(() => {
    loadTopics()
  }, [])

  useEffect(() => {
    if (view === 'exercise' && selectedDomainId) {
      fetchExercise()
    }
  }, [view, selectedDomainId])

  // --- Render helpers ---

  function renderTopicSelector() {
    return (
      <div className="mb-6 space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
        <h3 className="mb-2 text-sm font-semibold text-slate-600 uppercase tracking-wide">
          Choose a Topic (optional)
        </h3>

        {/* Random */}
        <button
          type="button"
          onClick={() => { setSelectedDomainId(null); setExercise(null) }}
          className={`w-full rounded-lg px-4 py-3 text-left transition-all ${
            selectedDomainId === null
              ? 'bg-blue-600 text-white shadow-md'
              : 'bg-white text-slate-700 hover:bg-blue-50 hover:text-blue-600'
          }`}
        >
          <span className="font-medium">🎲 Random (Surprise me!)</span>
        </button>

        {/* Grouped topics */}
        {Object.entries(categoriesMap).map(([cat, items]) => (
          <div key={cat}>
            <p className="mb-1 text-xs font-semibold text-slate-500 uppercase tracking-wide">
              {cat === 'stem' ? '🔬 STEM & Science' : cat === 'humanities' ? '📜 Humanities' : cat === 'health' ? '💪 Health & Wellness' : cat === 'social' ? '🤝 Social Studies' : cat === 'creative' ? '🎨 Creative Arts' : cat}
            </p>
            <div className="flex flex-wrap gap-2">
              {items.map((topic) => (
                <button
                  key={topic.id}
                  type="button"
                  onClick={() => setSelectedDomainId(topic.id)}
                  className={`rounded-lg px-3 py-2 text-sm transition-all ${
                    selectedDomainId === topic.id
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'bg-white text-slate-700 hover:bg-blue-50 hover:text-blue-600'
                  }`}
                >
                  {topic.name}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    )
  }

  function renderHistoryTab() {
    if (readingHistory.length === 0) {
      return (
        <div className="text-center py-12">
          <p className="text-gray-500 text-lg">No reading history yet.</p>
          <p className="text-gray-400 text-sm mt-2">Complete a reading exercise to see it here!</p>
          <button type="button" onClick={switchToExercise} className="mt-4 rounded bg-blue-600 px-6 py-2 text-white hover:bg-blue-700">
            Start a Reading Exercise
          </button>
        </div>
      )
    }

    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-800">📚 Reading History ({readingHistory.length})</h3>
        {readingHistory.map((reading) => (
          <div key={reading.id} className="rounded-lg border border-slate-200 bg-white p-4 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-2">
              <div>
                <p className="font-medium text-gray-800">{reading.lessonKeyPoint}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`rounded px-2 py-0.5 text-xs font-medium ${reading.domain === 'random' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                    {getDomainLabel(reading.domain)}
                  </span>
                  <span className="text-xs text-gray-500">
                    {new Date(reading.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                  </span>
                </div>
              </div>
              {reading.percentage !== null && (
                <span className={`rounded-full px-3 py-1 text-sm font-semibold ${reading.percentage >= 80 ? 'bg-green-100 text-green-700' : reading.percentage >= 60 ? 'bg-yellow-100 text-yellow-700' : reading.percentage > 0 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>
                  {reading.percentage !== null ? `${reading.percentage}%` : 'Not graded'}
                </span>
              )}
            </div>
            <p className="text-sm text-gray-600 line-clamp-2">{reading.passage}</p>
            <div className="mt-3 flex gap-2">
              <button type="button" onClick={() => selectReadingFromHistory(reading.id)} className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700">
                Re-read & Review
              </button>
            </div>
          </div>
        ))}
      </div>
    )
  }

  function renderExerciseView() {
    // Loading state (topic selected, fetching)
    if (!exercise && loading_) {
      return (
        <div className="flex items-center gap-4">
          {renderTopicSelector()}
          <p className="text-gray-500">Loading reading passage...</p>
        </div>
      )
    }

    // Empty state — no exercise loaded, show topic selector + start button
    if (!exercise) {
      return (
        <div className="space-y-4">
          {renderTopicSelector()}
          {!selectedDomainId && (
            <button onClick={fetchExercise} disabled={loading_} className="rounded bg-blue-600 px-6 py-3 text-white hover:bg-blue-700 disabled:bg-gray-400">
              {loading_ ? 'Loading...' : 'Start Reading Exercise'}
            </button>
          )}

          {selectedDomainId && (
            <p className="text-sm text-gray-500">Topic: {getDomainLabel(selectedDomainId)}</p>
          )}

          <button type="button" onClick={switchToHistory} className="text-sm text-blue-600 hover:underline">
            📚 View Reading History →
          </button>
        </div>
      )
    }

    // Submission result state
    if (submitted) {
      return (
        <div className="space-y-6">
          <div className="rounded border border-green-300 bg-green-50 p-6">
            <h3 className="mb-2 text-xl font-bold text-green-800">Exercise Graded!</h3>
            <p className="mb-4 text-lg text-green-700">Score: {submitted.score}/{submitted.maxScore} ({submitted.percentage}%)</p>
            <p className="whitespace-pre-line text-gray-700">{submitted.feedback}</p>
          </div>

          {submitted.gradeResult?.answers && (
            <div className="space-y-3">
              <h4 className="font-semibold text-gray-800">Answer Review:</h4>
              {submitted.gradeResult.answers.map((item) => (
                <div key={item.id} className="rounded bg-white p-3">
                  <p className="font-medium text-gray-800">Q{item.id}: {item.score}/{item.score + 1} points</p>
                  <p className="mt-1 text-sm text-gray-600">{item.feedback}</p>
                </div>
              ))}
            </div>
          )}

          <button type="button" onClick={() => setSubmitted(null)} className="rounded bg-amber-600 px-4 py-2 text-white hover:bg-amber-700">
            Revise and Resubmit
          </button>

          <div className="flex gap-3">
            <button type="button" onClick={() => { setExercise(null); setSubmitted(null); setSelectedDomainId(null) }} className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700">
              Try Another Exercise
            </button>
          </div>

          <p className="text-blue-600 hover:underline cursor-pointer" onClick={switchToHistory}>📚 View Reading History →</p>
        </div>
      )
    }

    // Main exercise view with passage + questions
    return (
      <form onSubmit={handleSubmit} className="space-y-6">
        {renderTopicSelector()}

        <div className="rounded border border-slate-300 bg-white p-6">
          {lessonKeyPoint && (
            <div className="mb-3 flex items-center gap-2 rounded bg-blue-50 px-4 py-2">
              <span className="text-lg">📚</span>
              <p className="text-sm font-medium text-blue-800">Lesson: {lessonKeyPoint}</p>
            </div>
          )}
          <h3 className="mb-4 text-lg font-semibold text-gray-800">Reading Passage</h3>
          <p className="whitespace-pre-line leading-relaxed text-gray-700">{exercise.passage}</p>
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
                      <input type="radio" name={`q-${q.id}`} value={option} checked={answers[q.id] === option} onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })} className="h-4 w-4" />
                      <span className="text-gray-700">{option}</span>
                    </label>
                  ))}
                </div>
              ) : (
                <textarea value={answers[q.id] || ''} onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })} placeholder="Type your answer here..." rows={3} className="mt-3 w-full rounded border border-slate-300 p-2" />
              )}
            </div>
          ))}
        </div>

        <button type="submit" disabled={loading_} className="rounded bg-green-600 px-6 py-2 text-white hover:bg-green-700 disabled:bg-gray-400">
          {loading_ ? 'Grading...' : 'Submit Answers'}
        </button>

        <p className="text-blue-600 hover:underline cursor-pointer" onClick={switchToHistory}>📚 View Reading History →</p>
      </form>
    )
  }

  // --- Main render ---
  return (
    <div>
      {/* View Toggle */}
      <div className="mb-4 flex gap-2">
        <button type="button" onClick={switchToExercise} className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${view === 'exercise' ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-blue-50'}`}>
          ✏️ New Exercise
        </button>
        <button type="button" onClick={switchToHistory} className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${view === 'history' ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-blue-50'}`}>
          📚 History ({readingHistory.length})
        </button>
      </div>

      {view === 'history' ? renderHistoryTab() : renderExerciseView()}
    </div>
  )
}