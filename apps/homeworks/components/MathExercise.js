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

function getPlaceLabels(count) {
  return PLACE_LABELS.slice(0, count).reverse()
}

function computePartialProducts(multiplicand, multiplier) {
  const mnd = parseInt(multiplicand, 10)
  return String(multiplier)
    .split('')
    .reverse()
    .map((d, shift) => {
      const value = mnd * parseInt(d, 10)
      return { value, shift, str: String(value) }
    })
}

function computeDivisionSteps(dividend, divisor) {
  const divStr = String(dividend)
  const steps = []
  let working = 0
  for (let i = 0; i < divStr.length; i++) {
    working = working * 10 + parseInt(divStr[i], 10)
    const qDigit = Math.floor(working / divisor)
    const sub = qDigit * divisor
    const remainder = working - sub
    steps.push({ bringDown: working, quotientDigit: qDigit, subtraction: sub, remainder, digitPosition: i })
    working = remainder
  }
  return steps
}

function LongMultiplicationGrid({ problem, digitsByCol, carriesByCol, onDigitChange, onCarryChange }) {
  const [multiplicand = '', multiplier = ''] = Array.isArray(problem.operands) ? problem.operands : []
  const answerStr = String(problem.expectedAnswer || '')
  const answerLen = answerStr.length

  const partialProducts = computePartialProducts(multiplicand, multiplier)

  const gridCols = Math.max(
    answerLen,
    multiplicand.length,
    multiplier.length,
    ...partialProducts.map((pp) => pp.str.length + pp.shift)
  )

  const gridLabels = getPlaceLabels(gridCols)
  const answerLabels = getPlaceLabels(answerLen)

  function StaticRow({ numStr, operator = '' }) {
    const padLeft = gridCols - numStr.length
    return (
      <div className="flex items-center">
        <div className="w-8 text-right pr-1 text-lg font-bold text-gray-700">{operator}</div>
        {Array.from({ length: padLeft }).map((_, i) => (
          <div key={i} className="w-10 h-10" />
        ))}
        {numStr.split('').map((d, i) => (
          <div key={i} className="w-10 h-10 flex items-center justify-center text-lg text-gray-800">{d}</div>
        ))}
      </div>
    )
  }

  function Separator() {
    return (
      <div className="flex my-1">
        <div className="w-8" />
        {Array.from({ length: gridCols }).map((_, i) => (
          <div key={i} className="w-10 border-t-2 border-gray-700" />
        ))}
      </div>
    )
  }

  return (
    <div className="inline-block font-mono">
      {/* Place-value column labels */}
      <div className="flex mb-1">
        <div className="w-8" />
        {gridLabels.map((label, i) => (
          <div key={i} className="w-10 text-center text-xs font-sans font-semibold uppercase tracking-wide text-slate-400">{label}</div>
        ))}
      </div>

      <StaticRow numStr={multiplicand} />
      <StaticRow numStr={multiplier} operator="×" />
      <Separator />

      {/* One row per digit of the multiplier (right-to-left), each is a partial product */}
      {partialProducts.map((pp, rowIdx) => {
        const ppLen = pp.str.length
        const leadingEmpties = gridCols - ppLen - pp.shift
        return (
          <div key={rowIdx} className="flex items-center">
            <div className="w-8 text-right pr-1 text-lg font-bold text-gray-400">
              {rowIdx > 0 ? '+' : ''}
            </div>
            {Array.from({ length: leadingEmpties }).map((_, i) => (
              <div key={`e${i}`} className="w-10 h-10" />
            ))}
            {/* Fill-in cells for the partial product */}
            {pp.str.split('').map((_, colIdx) => {
              const labelIdx = leadingEmpties + colIdx
              const key = `pp${rowIdx}_${colIdx}`
              return (
                <input
                  key={key}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={carriesByCol?.[key] || ''}
                  onChange={(e) => onCarryChange(key, e.target.value.replace(/[^0-9]/g, '').slice(-1))}
                  required
                  aria-label={`Partial product ${rowIdx + 1} digit ${gridLabels[labelIdx] ?? `pos${labelIdx}`}`}
                  className="h-10 w-10 rounded-sm border-2 border-purple-300 bg-purple-50 text-center text-lg focus:border-purple-500 focus:bg-white focus:outline-none"
                />
              )
            })}
            {/* Static trailing zeros for the positional shift */}
            {Array.from({ length: pp.shift }).map((_, i) => (
              <div key={`z${i}`} className="w-10 h-10 flex items-center justify-center text-lg text-gray-400">0</div>
            ))}
          </div>
        )
      })}

      <Separator />

      {/* Final answer row */}
      <div className="flex items-center">
        <div className="w-8" />
        {Array.from({ length: gridCols - answerLen }).map((_, i) => (
          <div key={i} className="w-10 h-10" />
        ))}
        {Array.from({ length: answerLen }).map((_, i) => (
          <input
            key={i}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={digitsByCol?.[i] || ''}
            onChange={(e) => onDigitChange(i, e.target.value.replace(/[^0-9]/g, '').slice(-1))}
            required
            aria-label={`Answer digit ${answerLabels[i]}`}
            className="h-10 w-10 rounded-sm border-2 border-blue-400 bg-blue-50 text-center text-lg focus:border-blue-600 focus:bg-white focus:outline-none"
          />
        ))}
      </div>
    </div>
  )
}

function LongDivisionGrid({ problem, digitsByCol, carriesByCol, onDigitChange, onCarryChange }) {
  const [dividend = '', divisor = ''] = Array.isArray(problem.operands) ? problem.operands : []
  const divLen = dividend.length
  const CW = 40 // px per column

  const allSteps = computeDivisionSteps(parseInt(dividend, 10), parseInt(divisor, 10))
  const firstActive = allSteps.findIndex((s) => s.quotientDigit > 0)
  const start = firstActive < 0 ? 0 : firstActive
  const stepsToShow = allSteps.slice(start).map((s, idx) => ({
    ...s,
    col: start + idx,
    isFirst: idx === 0,
    stepNum: idx + 1,
  }))

  const quotientLen = divLen - start
  const quotientLabels = getPlaceLabels(quotientLen)
  const totalCols = 1 + divLen // first col = left gutter for minus sign
  const rowWidth = `${totalCols * CW}px`

  function PlaceholderRow({ height = 10 }) {
    return null // not used; structure handled inline
  }

  function emptyCells(count, key) {
    return Array.from({ length: count }).map((_, i) => (
      <div key={`${key}_${i}`} className="w-10 h-10" />
    ))
  }

  return (
    <div className="inline-flex items-start font-mono">
      {/* Divisor outside the bracket */}
      <div className="flex h-10 items-center pr-2 text-lg text-gray-800 mt-10">{divisor}</div>

      <div className="flex flex-col">
        {/* Quotient row — inputs positioned over their dividend columns */}
        <div className="flex" style={{ width: rowWidth }}>
          <div className="w-10 h-10" /> {/* gutter */}
          {emptyCells(start, 'qpad')}
          {Array.from({ length: quotientLen }).map((_, qi) => (
            <input
              key={qi}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digitsByCol?.[qi] || ''}
              onChange={(e) => onDigitChange(qi, e.target.value.replace(/[^0-9]/g, '').slice(-1))}
              required
              aria-label={`Quotient digit ${quotientLabels[qi]}`}
              className="h-10 w-10 rounded-sm border-2 border-blue-400 bg-blue-50 text-center text-lg focus:border-blue-600 focus:bg-white focus:outline-none"
            />
          ))}
        </div>

        {/* Dividend row (static), with top + left bracket borders */}
        <div className="flex" style={{ width: rowWidth }}>
          <div className="w-10 h-10" />
          <div className="flex border-t-4 border-l-4 border-gray-700">
            {dividend.split('').map((d, i) => (
              <div key={i} className="w-10 h-10 flex items-center justify-center text-lg text-gray-800">{d}</div>
            ))}
          </div>
        </div>

        {/* Step-by-step work area */}
        {stepsToShow.map((step) => {
          const subStr = String(step.subtraction)
          const sLen = subStr.length
          const sStart = step.col + 1 - sLen // leftmost column the subtraction occupies (0-indexed)

          const workingStr = String(step.bringDown)
          const wLen = workingStr.length
          const wStart = step.col + 1 - wLen

          return (
            <div key={step.col}>
              {/* Working value row — skip for the very first step since it's already visible in the dividend */}
              {!step.isFirst && (
                <div className="flex" style={{ width: rowWidth }} data-testid={`working-${step.stepNum}`}>
                  <div className="w-10 h-10" />
                  {emptyCells(wStart, `w${step.stepNum}`)}
                  {workingStr.split('').map((d, ci) => (
                    <div key={ci} className="w-10 h-10 flex items-center justify-center text-lg text-gray-700">{d}</div>
                  ))}
                </div>
              )}

              {/* Subtraction row: minus sign in gutter, fill-in digits aligned under the working value */}
              <div className="flex" style={{ width: rowWidth }}>
                <div className="w-10 h-10 flex items-center justify-end pr-1 text-base text-gray-600">−</div>
                {emptyCells(sStart, `s${step.stepNum}`)}
                {subStr.split('').map((_, ci) => {
                  const key = `step${step.stepNum}_${ci}`
                  return (
                    <input
                      key={ci}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={carriesByCol?.[key] || ''}
                      onChange={(e) => onCarryChange(key, e.target.value.replace(/[^0-9]/g, '').slice(-1))}
                      required
                      aria-label={`Step ${step.stepNum} subtraction digit ${ci + 1}`}
                      className="h-10 w-10 rounded border-2 border-dashed border-green-400 bg-green-50 text-center text-lg focus:border-green-600 focus:outline-none"
                    />
                  )
                })}
              </div>

              {/* Underline below subtraction, spanning the same columns */}
              <div className="flex" style={{ width: rowWidth }}>
                <div className="w-10" />
                {Array.from({ length: sStart }).map((_, ci) => (
                  <div key={`u_pad_${ci}`} className="w-10" />
                ))}
                {Array.from({ length: sLen }).map((_, ci) => (
                  <div key={`u_${ci}`} className="w-10 border-t-2 border-gray-600" />
                ))}
              </div>
            </div>
          )
        })}

        {/* Final remainder row — at the rightmost column */}
        {stepsToShow.length > 0 && (
          <div className="flex" style={{ width: rowWidth }} data-testid="final-remainder">
            <div className="w-10 h-10" />
            {emptyCells(divLen - 1, 'rem')}
            <div className="w-10 h-10 flex items-center justify-center text-lg text-gray-700">
              {stepsToShow[stepsToShow.length - 1].remainder}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function ColumnMethodGrid({ problem, digitsByCol, carriesByCol, onDigitChange, onCarryChange }) {
  const operands = Array.isArray(problem.operands) ? problem.operands : []
  if (operands.length === 0) return null

  const maxLen = Math.max(
    String(problem.expectedAnswer || '').length,
    ...operands.map((operand) => String(operand).length)
  )
  const labels = getPlaceLabels(maxLen)
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

function highlightNumbers(text) {
  const parts = String(text || '').split(/(\b\d[\d,]*\b)/g)
  return parts.map((part, i) => {
    if (/^\d[\d,]*$/.test(part)) {
      return (
        <strong key={i} className="rounded bg-amber-100 px-1.5 py-0.5 font-bold text-amber-900">
          {part}
        </strong>
      )
    }
    return <span key={i}>{part}</span>
  })
}

function WordProblemCard({ problem, index }) {
  const numbers = String(problem.problem || '').match(/\b\d[\d,]*\b/g) || []
  return (
    <div className="mb-4 overflow-hidden rounded-lg border-l-4 border-amber-400 bg-gradient-to-br from-amber-50 to-white shadow-sm">
      <div className="flex items-center gap-2 border-b border-amber-200 bg-amber-100/60 px-4 py-2">
        <span aria-hidden="true" className="text-lg">📖</span>
        <span className="text-xs font-bold uppercase tracking-wider text-amber-800">
          Word Problem #{index + 1}
        </span>
      </div>
      <p className="px-4 py-4 text-base leading-relaxed text-gray-800">
        {highlightNumbers(problem.problem)}
      </p>
      {numbers.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-t border-amber-100 bg-white px-4 py-2 text-xs text-slate-600">
          <span className="font-semibold uppercase tracking-wide text-slate-500">Numbers:</span>
          {numbers.map((n, i) => (
            <span key={i} className="rounded-full bg-amber-100 px-2 py-0.5 font-mono font-semibold text-amber-900">
              {n}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

function getOperatorLabel(op) {
  if (op === '+') return 'addition'
  if (op === '-') return 'subtraction'
  if (op === '*') return 'multiplication'
  if (op === '/') return 'division'
  return ''
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
          <h4 className="mb-3 text-lg font-semibold text-gray-800">Problem {idx + 1}</h4>

          {problem.problemType !== 'column-method' ? (
            <WordProblemCard problem={problem} index={idx} />
          ) : (
            <p className="mb-4 font-mono text-xl font-semibold text-gray-800">
              {problem.problem}
            </p>
          )}

          {problem.problemType === 'column-method' ? (
            <div className="mb-4 overflow-x-auto rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-600">
                {problem.operator === '*' ? 'Long Multiplication: fill each digit box' : problem.operator === '/' ? 'Long Division: fill each digit box' : 'Column Method: fill each digit box'}
              </p>
              {problem.operator === '*' || problem.operator === '/' ? (
                problem.operator === '*' ? (
                  <LongMultiplicationGrid
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
                ) : (
                  <LongDivisionGrid
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
                )
              ) : (
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
              )}
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
