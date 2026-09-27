'use client'

import { useState, useEffect } from 'react'

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00Z')
  // Use UTC to avoid timezone shifts messing up the date display
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
}

function getSubjectLabel(subject) {
  return subject === 'math' ? '🔢 Math' : '📚 English'
}

function getTypeLabel(type) {
  const labels = { 'reading': 'Reading', 'writing': 'Writing', 'problem-set': 'Problem Set' }
  return labels[type] || type
}

export default function ReviewPage() {
  const [days, setDays] = useState([])
  const [selectedDay, setSelectedDay] = useState(null)
  const [loading, setLoading] = useState(true)

  async function loadData() {
    setLoading(true)
    try {
      const res = await fetch('/homeworks/api/review')
      const json = await res.json()
      if (!json.error) {
        setDays(json.days || [])
      }
    } catch (e) {
      console.error('Failed to load review data:', e)
    } finally {
      setLoading(false)
    }
  }

  async function loadDay(dayStr) {
    setSelectedDay(dayStr)
  }

  useEffect(() => { loadData() }, [])

  if (loading) return <div className="text-gray-600 p-8">Loading review data...</div>

  return (
    <div className="max-w-5xl mx-auto p-6">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">📋 Homework Review</h1>
      <p className="text-gray-500 mb-6">All submissions from the last 30 days. Public access — no login required.</p>

      {days.length === 0 ? (
        <div className="text-gray-500 bg-gray-50 rounded-lg p-8 text-center">
          No homework submissions yet. Submissions will appear here as students complete exercises.
        </div>
      ) : (
        <div className="space-y-6">
          {days.map((day) => (
            <DayCard
              key={day.date}
              day={day}
              isSelected={selectedDay === day.date}
              onSelect={() => loadDay(day.date)}
            />
          ))}
        </div>
      )}

      <button onClick={loadData} className="mt-6 rounded bg-slate-600 px-4 py-2 text-white hover:bg-slate-700">
        🔄 Refresh Data
      </button>
    </div>
  )
}

function DayCard({ day, isSelected, onSelect }) {
  const totalSubmissions = day.submissions.length + day.readings.length
  const avgScore = (() => {
    const allScores = [
      ...day.submissions.map(s => s.percentage),
      ...day.readings.filter(r => r.percentage !== null).map(r => r.percentage),
    ]
    if (!allScores.length) return 0
    return Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length)
  })()

  return (
    <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
      <button
        onClick={onSelect}
        className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-4">
          {/* Use string comparison for date sorting */}
          <span className="font-semibold text-gray-800">{formatDate(day.date)}</span>
          <span className="text-sm text-gray-500">{totalSubmissions} submission{totalSubmissions !== 1 ? 's' : ''}</span>
        </div>
        <div className="flex items-center gap-3">
          {avgScore > 0 && (
            <span className={`rounded-full px-3 py-1 text-sm font-semibold ${
              avgScore >= 80 ? 'bg-green-100 text-green-700' : avgScore >= 60 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
            }`}>
              Avg {avgScore}%
            </span>
          )}
          <span className="text-gray-400">{isSelected ? '▲' : '▼'}</span>
        </div>
      </button>

      {isSelected && (
        <div className="border-t border-slate-100 p-4 space-y-4">
          {/* Submissions */}
          {day.submissions.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-600 mb-2 uppercase tracking-wide">Submissions</h3>
              <div className="space-y-3">
                {day.submissions.map((sub) => (
                  <SubmissionCard key={sub.id} submission={sub} />
                ))}
              </div>
            </div>
          )}

          {/* Readings */}
          {day.readings.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-600 mb-2 uppercase tracking-wide">Reading Sessions</h3>
              <div className="space-y-3">
                {day.readings.map((reading) => (
                  <ReadingCard key={reading.id} reading={reading} />
                ))}
              </div>
            </div>
          )}

          {day.submissions.length === 0 && day.readings.length === 0 && (
            <p className="text-gray-400 text-center py-4">No data for this day.</p>
          )}
        </div>
      )}
    </div>
  )
}

function SubmissionCard({ submission }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between mb-2">
        <div>
          <span className="font-medium text-gray-800">{getSubjectLabel(submission.subject)}</span>
          <span className="text-xs text-gray-500 ml-2">{getTypeLabel(submission.type)}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`rounded-full px-3 py-1 text-sm font-semibold ${
            submission.percentage >= 80 ? 'bg-green-100 text-green-700' :
            submission.percentage >= 60 ? 'bg-yellow-100 text-yellow-700' :
            submission.percentage > 0 ? 'bg-red-100 text-red-700' :
            'bg-gray-100 text-gray-600'
          }`}>
            {submission.percentage}%
          </span>
        </div>
      </div>

      <p className="text-xs text-gray-400">{new Date(submission.date).toLocaleString()}</p>

      <button onClick={() => setExpanded(!expanded)} className="mt-2 text-sm text-blue-600 hover:underline">
        {expanded ? 'Hide details ▲' : 'Show exercise & answers ▼'}
      </button>

      {expanded && (
        <div className="mt-3 space-y-4 bg-slate-50 rounded p-3 text-sm">
          {/* Grading subsection */}
          <div className="bg-white rounded p-3 space-y-2">
            <h4 className="font-semibold text-gray-700">Grading</h4>
            <p className="text-xs text-gray-600">
              Score: {submission.score} / {submission.max_score} ({submission.percentage}%)
            </p>
            {submission.feedback && (
              <div>
                <p className="text-xs font-semibold text-gray-600 uppercase">Feedback:</p>
                <p className="text-gray-700 whitespace-pre-wrap mt-1">{submission.feedback}</p>
              </div>
            )}
            {submission.details && submission.subject === 'math' && submission.type === 'problem-set' &&
             submission.details.problems && (
              <div>
                <p className="text-xs font-semibold text-gray-600 uppercase mb-1">Problem Results:</p>
                <div className="space-y-1">
                  {submission.details.problems.map((problem, idx) => (
                    <p key={idx} className="text-xs text-gray-700">
                      {problem.correct ? '✅' : '❌'} Problem {idx + 1}: {problem.prompt || problem.text}
                    </p>
                  ))}
                </div>
              </div>
            )}
            {submission.details && submission.subject === 'english' && submission.type === 'writing' &&
             submission.details.criteria && (
              <div>
                <p className="text-xs font-semibold text-gray-600 uppercase mb-1">Rubric Criteria:</p>
                <div className="space-y-1">
                  {submission.details.criteria.map((criterion, idx) => (
                    <p key={idx} className="text-xs text-gray-700">
                      {criterion.name}: {criterion.score} / {criterion.maxScore || criterion.max_score}
                    </p>
                  ))}
                </div>
              </div>
            )}
            {submission.details && submission.subject === 'english' && submission.type === 'reading' &&
             submission.details.answers && (
              <div>
                <p className="text-xs font-semibold text-gray-600 uppercase mb-1">Per-Question Grade:</p>
                <div className="space-y-1">
                  {submission.details.answers.map((answer, idx) => (
                    <p key={idx} className="text-xs text-gray-700">
                      {answer.correct ? '✅' : '❌'} Question {idx + 1}
                    </p>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Render exercise content based on subject/type */}
          {submission.subject === 'math' && submission.type === 'problem-set' ? (
            <MathExerciseDetails exercise={submission.exercise} answers={submission.answers} />
          ) : submission.subject === 'english' && submission.type === 'writing' ? (
            <WritingExerciseDetails exercise={submission.exercise} answers={submission.answers} />
          ) : (
            <ReadingExerciseDetails exercise={submission.exercise} answers={submission.answers} />
          )}
        </div>
      )}
    </div>
  )
}

function MathExerciseDetails({ exercise, answers }) {
  if (!exercise) return <p className="text-gray-400">No exercise data available.</p>

  const problems = exercise.problems || []
  const studentAnswersObj = answers // { [problemIndex]: 'student answer' }

  return (
    <div className="space-y-3">
      {problems.length > 0 ? (
        <>
          <h4 className="font-semibold text-gray-700">Problems & Answers</h4>
          {problems.map((problem, idx) => (
            <div key={idx} className="bg-white rounded p-3 space-y-1">
              <p className="text-gray-800 font-medium">{problem.prompt || problem.text}</p>
              {problem.answer && (
                <p className="text-green-700 text-xs">✅ Correct answer: {problem.answer}</p>
              )}
              {studentAnswersObj && studentAnswersObj[idx] !== undefined && (
                <p className="text-blue-700 text-xs">📝 Student answer: {studentAnswersObj[idx]}</p>
              )}
            </div>
          ))}
        </>
      ) : (
        <p className="text-gray-500">
          {JSON.stringify(exercise)}
        </p>
      )}
    </div>
  )
}

function WritingExerciseDetails({ exercise, answers }) {
  if (!exercise) return <p className="text-gray-400">No exercise data available.</p>

  const prompt = exercise.prompt || exercise.text || 'No prompt available'
  const studentAnswer = answers // Student's written response

  return (
    <div className="space-y-3">
      <h4 className="font-semibold text-gray-700">Writing Exercise</h4>
      <div>
        <p className="text-xs font-semibold text-gray-600 uppercase">Prompt:</p>
        <p className="text-gray-700 whitespace-pre-wrap mt-1">{prompt}</p>
      </div>
      {studentAnswer && (
        <div>
          <p className="text-xs font-semibold text-gray-600 uppercase">Student's Answer:</p>
          <p className="text-gray-700 whitespace-pre-wrap mt-1 bg-blue-50 p-2 rounded">{studentAnswer}</p>
        </div>
      )}
    </div>
  )
}

function ReadingExerciseDetails({ exercise, answers }) {
  if (!exercise) return <p className="text-gray-400">No exercise data available.</p>

  const passage = exercise.passage || ''
  const questions = exercise.questions || []

  return (
    <div className="space-y-3">
      {passage && (
        <div>
          <h4 className="font-semibold text-gray-700">Passage</h4>
          <p className="text-gray-600 whitespace-pre-wrap mt-1 leading-relaxed">{passage}</p>
        </div>
      )}
      {questions.length > 0 && (
        <div>
          <h4 className="font-semibold text-gray-700">Questions & Answers</h4>
          <div className="space-y-2 mt-1">
            {questions.map((q, idx) => (
              <div key={idx} className="bg-white rounded p-2">
                <p className="text-gray-800 font-medium">Q{q.id || idx + 1}: {q.question}</p>
                {q.correctAnswer && (
                  <p className="text-xs text-green-700 mt-1">✅ Correct answer: {q.correctAnswer}</p>
                )}
                {answers && (typeof answers === 'object' ? answers[q.id] : undefined) !== undefined && (
                  <p className="text-xs text-blue-700 mt-1">📝 Student answer: {answers[q.id]}</p>
                )}
                {q.type === 'multiple-choice' && q.options && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {q.options.map((opt, oidx) => (
                      <span key={oidx} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                        {opt}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function ReadingCard({ reading }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="font-medium text-gray-800">{reading.lesson_key_point}</span>
        <div className="flex items-center gap-2">
          {reading.domain !== 'random' && (
            <span className="text-xs text-gray-500 bg-blue-100 px-2 py-0.5 rounded">{reading.domain}</span>
          )}
          {reading.percentage !== null && (
            <span className={`rounded-full px-3 py-1 text-sm font-semibold ${
              reading.percentage >= 80 ? 'bg-green-100 text-green-700' :
              reading.percentage >= 60 ? 'bg-yellow-100 text-yellow-700' :
              reading.percentage > 0 ? 'bg-red-100 text-red-700' :
              'bg-gray-100 text-gray-600'
            }`}>
              {reading.percentage}%
            </span>
          )}
        </div>
      </div>

      <p className="text-xs text-gray-400">{new Date(reading.date).toLocaleString()}</p>

      {expanded && (
        <div className="mt-3 space-y-3 bg-slate-50 rounded p-3 text-sm">
          {reading.passage && (
            <div>
              <span className="font-semibold text-gray-700">Passage:</span>
              <p className="text-gray-600 mt-1 whitespace-pre-wrap leading-relaxed">{reading.passage}</p>
            </div>
          )}
          {reading.questions && reading.questions.length > 0 && (
            <div>
              <span className="font-semibold text-gray-700">Questions:</span>
              <div className="space-y-2 mt-1">
                {reading.questions.map((q) => (
                  <div key={q.id} className="bg-white rounded p-2">
                    <p className="text-gray-700">Q{q.id}: {q.question}</p>
                    <p className="text-xs text-green-700 mt-1">✅ Correct answer: {q.correctAnswer}</p>
                    {reading.answers && reading.answers[q.id] !== undefined && (
                      <p className="text-xs text-blue-700 mt-1">📝 Student answer: {reading.answers[q.id]}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <button onClick={() => setExpanded(!expanded)} className="mt-2 text-sm text-blue-600 hover:underline">
        {expanded ? 'Hide details ▲' : 'Show passage & questions ▼'}
      </button>
    </div>
  )
}