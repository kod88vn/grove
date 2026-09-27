'use client'

import Link from 'next/link'
import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import dynamic from 'next/dynamic'
const EnglishExerciseClient = dynamic(() => import('../components/EnglishExercise').then(mod => mod.EnglishExercise), { ssr: false })
const MathExerciseClient = dynamic(() => import('../components/MathExercise').then(mod => mod.MathExercise), { ssr: false })

function HomeworksContent() {
  const searchParams = useSearchParams()
  const isMathSection = searchParams?.get('section') === 'math'
  const skillCategory = searchParams?.get('skillCategory')
  const isPracticeMode = searchParams?.get('practice') === '1' && Boolean(skillCategory)
  const [activeSection, setActiveSection] = useState(isMathSection ? 'math' : 'english')
  const [lastSubmission, setLastSubmission] = useState(null)

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="mb-2 text-4xl font-bold text-slate-900">Daily Homeworks</h1>
          <p className="text-slate-600">AI-powered learning for Grade 5</p>
        </div>
        <Link href="/review" className="rounded-lg bg-slate-700 px-4 py-2 text-white hover:bg-slate-800">
          📋 Review Submissions
        </Link>
      </div>

      {/* Navigation Tabs */}
      <div className="mb-6 flex gap-2 border-b border-slate-200">
        <button
          onClick={() => setActiveSection('english')}
          className={`px-4 py-3 font-medium transition-all ${
            activeSection === 'english'
              ? 'border-b-2 border-blue-600 text-blue-600'
              : 'text-slate-600 hover:text-slate-800'
          }`}
        >
          📚 English
        </button>
        <button
          onClick={() => setActiveSection('math')}
          className={`px-4 py-3 font-medium transition-all ${
            activeSection === 'math'
              ? 'border-b-2 border-green-600 text-green-600'
              : 'text-slate-600 hover:text-slate-800'
          }`}
        >
          🔢 Math
        </button>
      </div>

      {/* Success Banner */}
      {lastSubmission && (
        <div className="mb-6 rounded-lg border border-green-300 bg-green-50 p-4">
          <p className="text-green-800">
            ✓ Great work! Score: {lastSubmission.score}/{lastSubmission.maxScore} ({lastSubmission.percentage}%)
          </p>
          <button
            onClick={() => setLastSubmission(null)}
            className="mt-2 text-sm text-green-600 hover:text-green-700"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Content */}
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        {activeSection === 'english' && (
          <div>
            <h2 className="mb-6 text-2xl font-bold text-gray-800">📚 English - Reading & Comprehension</h2>
            <p className="mb-6 text-gray-600">
              Read a short passage and answer questions to test your understanding. Mix of
              multiple choice and written answers.
            </p>
            <EnglishExerciseClient onSubmit={setLastSubmission} />
          </div>
        )}

        {activeSection === 'math' && (
          <div>
            <h2 className="mb-6 text-2xl font-bold text-gray-800">🔢 Math - Step-by-Step Problems</h2>
            <p className="mb-6 text-gray-600">
              Solve math problems by showing your work step-by-step. Covers addition, subtraction,
              multiplication, and division. Remember to show all your steps!
            </p>
            <MathExerciseClient
              onSubmit={setLastSubmission}
              skillCategory={isPracticeMode ? skillCategory : undefined}
              autoStart={isPracticeMode}
            />
          </div>
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

export default function HomeworksPage() {
  return (
    <Suspense fallback={null}>
      <HomeworksContent />
    </Suspense>
  )
}