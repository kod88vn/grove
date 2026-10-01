'use client'

import { check } from '@grove/curriculum'
import { useState } from 'react'

import { correctValueFor } from '@/app/dev/widgets/samples'

import { AnswerWidget } from './widgets/AnswerWidget'
import { emptyValue, toResponse } from './widgets/response'

const verdictText = {
  correct: 'Correct',
  wrong: 'Not quite',
  invalid: "I couldn't read that",
  'not-simplest': 'Right value — but not in lowest terms',
}

const coinLabels = { 25: ['quarter', 'quarters'], 10: ['dime', 'dimes'], 5: ['nickel', 'nickels'], 1: ['penny', 'pennies'] }

function GalleryCard({ sample }) {
  const [value, setValue] = useState(() => emptyValue(sample.instance))
  const [verdict, setVerdict] = useState(null)
  const [isRevealed, setIsRevealed] = useState(false)

  function checkAnswer() {
    const result = check(sample.widget, sample.answer, toResponse(sample.instance, value))
    setVerdict(result)
  }

  const answer = correctValueFor(sample)
  const answerText = sample.widget === 'coins'
    ? Object.entries(answer)
      .filter(([, count]) => count > 0)
      .map(([coin, count]) => `${count} ${coinLabels[coin][count === 1 ? 0 : 1]}`)
      .join(', ')
    : Array.isArray(answer) ? answer.join(', ') : answer

  return (
    <article data-widget={sample.widget} className="flex min-w-0 flex-col gap-4 rounded-lg border p-4">
      <h2 className="text-lg font-semibold">{sample.widget}</h2>
      <AnswerWidget instance={sample.instance} value={value} onChange={setValue} />
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={checkAnswer} className="rounded bg-blue-600 px-4 py-2 font-semibold text-white">
          Check
        </button>
        <button
          type="button"
          onClick={() => setIsRevealed(true)}
          className="rounded bg-amber-100 px-4 py-2 font-semibold text-amber-900"
        >
          Show the answer (dev only)
        </button>
      </div>
      {verdict && (
        <div data-verdict={verdict.correct ? 'correct' : verdict.reason}>
          {verdict.correct ? verdictText.correct : verdictText[verdict.reason]}
        </div>
      )}
      {isRevealed && (
        <div data-dev-only>
          <h3>How Nora solved it</h3>
          <div>{answerText}</div>
          <div>{sample.explanation}</div>
        </div>
      )}
    </article>
  )
}

export function WidgetGallery({ samples }) {
  return (
    <section className="grid gap-6 md:grid-cols-2">
      {samples.map((sample) => <GalleryCard key={sample.widget} sample={sample} />)}
    </section>
  )
}
