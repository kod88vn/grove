'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { EnglishExercise } from '../components/EnglishExercise'
import { MathExercise } from '../components/MathExercise'
import { ProgressReview } from '../components/ProgressReview'
import { ParentView } from '../components/ParentView'

const SECTIONS = {
  english: 'english',
  math: 'math',
  progress: 'progress',
  parent: 'parent',
}

export default function HomeworksPage() {
  const [activeSection, setActiveSection] = useState(SECTIONS.english)
  const [lastSubmission, setLastSubmission] = useState(null)
  const [requestedSection, setRequestedSection] = useState(null)
  const [requestedSkillCategory, setRequestedSkillCategory] = useState(undefined)
  const [autoStartPractice, setAutoStartPractice] = useState(false)
  const isSkillsLibraryNavEnabled = ['1', 'true'].includes(
    String(process.env.NEXT_PUBLIC_ENABLE_SKILLS_LIBRARY_NAV || '').toLowerCase()
  )

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    setRequestedSection(params.get('section'))
    setRequestedSkillCategory(params.get('skillCategory') || undefined)
    setAutoStartPractice(params.get('practice') === '1')
  }, [])

  useEffect(() => {
    if (requestedSection === SECTIONS.math) {
      setActiveSection(SECTIONS.math)
    }
  }, [requestedSection])

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-8">
        <h1 className="mb-2 text-4xl font-bold text-slate-900">Daily Homeworks</h1>
        <p className="text-slate-600">AI-powered learning for Grade 5</p>
      </div>

      {/* Navigation Tabs */}
      <div className="mb-6 flex gap-2 border-b border-slate-200">
        <button
          onClick={() => setActiveSection(SECTIONS.english)}
          className={`px-4 py-3 font-medium transition-all ${
            activeSection === SECTIONS.english
              ? 'border-b-2 border-blue-600 text-blue-600'
              : 'text-slate-600 hover:text-slate-800'
          }`}
        >
          📚 English
        </button>
        <button
          onClick={() => setActiveSection(SECTIONS.math)}
          className={`px-4 py-3 font-medium transition-all ${
            activeSection === SECTIONS.math
              ? 'border-b-2 border-green-600 text-green-600'
              : 'text-slate-600 hover:text-slate-800'
          }`}
        >
          🔢 Math
        </button>
        <button
          onClick={() => setActiveSection(SECTIONS.progress)}
          className={`px-4 py-3 font-medium transition-all ${
            activeSection === SECTIONS.progress
              ? 'border-b-2 border-purple-600 text-purple-600'
              : 'text-slate-600 hover:text-slate-800'
          }`}
        >
          📊 Progress
        </button>
        <button
          onClick={() => setActiveSection(SECTIONS.parent)}
          className={`px-4 py-3 font-medium transition-all ${
            activeSection === SECTIONS.parent
              ? 'border-b-2 border-orange-600 text-orange-600'
              : 'text-slate-600 hover:text-slate-800'
          }`}
        >
          👨‍👩‍👧 Parent
        </button>

        {isSkillsLibraryNavEnabled && (
          <Link
            href="/library"
            className="ml-auto px-4 py-3 font-medium text-slate-600 transition-all hover:text-slate-800"
          >
            📚 Skills Library
          </Link>
        )}
      </div>

      {/* Success Banner */}
      {lastSubmission && (
        <div className="mb-6 rounded-lg border border-green-300 bg-green-50 p-4">
          <p className="text-green-800">
            ✓ Great work! Score: {lastSubmission.score}/{lastSubmission.maxScore} (
            {lastSubmission.percentage}%)
          </p>
          <button
            onClick={() => setLastSubmission(null)}
            className="mt-2 text-sm text-green-600 hover:text-green-700"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Content Sections */}
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        {activeSection === SECTIONS.english && (
          <div>
            <h2 className="mb-6 text-2xl font-bold text-gray-800">📚 English - Reading & Comprehension</h2>
            <p className="mb-6 text-gray-600">
              Read a short passage and answer questions to test your understanding. Mix of
              multiple choice and written answers.
            </p>
            <EnglishExercise onSubmit={setLastSubmission} />
          </div>
        )}

        {activeSection === SECTIONS.math && (
          <div>
            <h2 className="mb-6 text-2xl font-bold text-gray-800">🔢 Math - Step-by-Step Problems</h2>
            <p className="mb-6 text-gray-600">
              Solve math problems by showing your work step-by-step. Covers addition, subtraction,
              multiplication, and division. Remember to show all your steps!
            </p>
            <MathExercise
              onSubmit={setLastSubmission}
              skillCategory={requestedSkillCategory}
              autoStart={autoStartPractice}
            />
          </div>
        )}

        {activeSection === SECTIONS.progress && (
          <div>
            <h2 className="mb-6 text-2xl font-bold text-gray-800">📊 Progress Review</h2>
            <p className="mb-6 text-gray-600">
              Track your learning progress across English and Math. See your average scores and
              recent submissions.
            </p>
            <ProgressReview key={lastSubmission?.submittedAt} />
          </div>
        )}

        {activeSection === SECTIONS.parent && (
          <ParentView />
        )}
      </div>

      {/* Tips Section */}
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
          <h3 className="mb-2 font-semibold text-blue-900">💡 English Tips</h3>
          <ul className="space-y-1 text-sm text-blue-800">
            <li>• Read the passage carefully, twice if needed</li>
            <li>• Take notes on important points</li>
            <li>• Answer in your own words when possible</li>
          </ul>
        </div>
        <div className="rounded-lg border border-green-200 bg-green-50 p-4">
          <h3 className="mb-2 font-semibold text-green-900">💡 Math Tips</h3>
          <ul className="space-y-1 text-sm text-green-800">
            <li>• Always show your work step-by-step</li>
            <li>• Check your calculations twice</li>
            <li>• Line up numbers carefully</li>
          </ul>
        </div>
      </div>
    </main>
  )
}
