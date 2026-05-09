'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { CROSSWORD_LEVELS, pickCrosswordPuzzle, scoreCrosswordAnswers } from '../index.js'
import { createBurstParticles, playArcadeEffect } from './arcadeFx'

async function fetchCrosswordFromAI(level) {
  const res = await fetch('/api/nora-crossword', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ level }),
    signal: AbortSignal.timeout(7000),
  })
  if (!res.ok) throw new Error('ai_unavailable')
  const json = await res.json()
  if (json.error || !json.puzzle) throw new Error(json.error || 'bad_puzzle')
  return json.puzzle
}

function cellKey(row, col) {
  return `${row},${col}`
}

function getEntryCells(entry) {
  return Array.from({ length: entry.answer.length }, (_, offset) => ({
    row: entry.row + (entry.direction === 'down' ? offset : 0),
    col: entry.col + (entry.direction === 'across' ? offset : 0),
  }))
}

const LEVEL_META = {
  elementary: { label: 'Elementary', detail: 'Short words, ~8 entries' },
  middleschool: { label: 'Middle School', detail: 'Themed words, ~12 entries' },
  highschool: { label: 'High School', detail: 'Advanced words, ~16 entries' },
}

export default function CrosswordGame() {
  const [level, setLevel] = useState('elementary')
  const [puzzle, setPuzzle] = useState(null)
  const [answers, setAnswers] = useState({})
  const [cells, setCells] = useState({})
  const [score, setScore] = useState(null)
  const [burst, setBurst] = useState([])
  const [loading, setLoading] = useState(false)
  const [aiSource, setAiSource] = useState(false)
  const [showLevelModal, setShowLevelModal] = useState(true)

  const startPuzzle = useCallback(async (chosenLevel) => {
    setShowLevelModal(false)
    setLoading(true)
    setScore(null)
    try {
      const nextPuzzle = await fetchCrosswordFromAI(chosenLevel)
      setPuzzle(nextPuzzle)
      setAnswers({})
      setCells({})
      setAiSource(true)
    } catch {
      setPuzzle(pickCrosswordPuzzle(chosenLevel))
      setAnswers({})
      setCells({})
      setAiSource(false)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    setShowLevelModal(true)
  }, [])

  const entryCells = useMemo(
    () => Object.fromEntries((puzzle?.entries ?? []).map((entry) => [entry.id, getEntryCells(entry)])),
    [puzzle]
  )

  const activeCells = useMemo(() => {
    const all = new Set()
    for (const entry of puzzle?.entries ?? []) {
      for (const point of entryCells[entry.id]) {
        all.add(cellKey(point.row, point.col))
      }
    }
    return all
  }, [entryCells, puzzle])

  const celebrate = (effect) => {
    playArcadeEffect(effect)
    setBurst(createBurstParticles(14))
    setTimeout(() => setBurst([]), 520)
  }

  const applyCellValue = (row, col, value) => {
    const normalized = String(value || '')
      .toUpperCase()
      .replace(/[^A-Z]/g, '')
      .slice(-1)

    const key = cellKey(row, col)
    setCells((previous) => {
      const next = { ...previous, [key]: normalized }

      setAnswers((previousAnswers) => {
        const updated = { ...previousAnswers }
        for (const entry of puzzle?.entries ?? []) {
          const points = entryCells[entry.id]
          const touchesEditedCell = points.some((point) => point.row === row && point.col === col)
          if (!touchesEditedCell) continue
          updated[entry.id] = points.map((point) => next[cellKey(point.row, point.col)] || '').join('')
        }
        return updated
      })

      return next
    })
  }

  const onCheck = () => {
    if (!puzzle) return
    const result = scoreCrosswordAnswers(answers, puzzle)
    setScore(result)
    if (result.solved) celebrate('win')
    else if (result.correct > 0) celebrate('success')
    else playArcadeEffect('fail')
  }

  const onNewPuzzle = () => {
    setShowLevelModal(true)
  }

  const onReveal = () => {
    if (!puzzle) return
    setCells((previous) => {
      const next = { ...previous }
      for (const entry of puzzle.entries) {
        const points = getEntryCells(entry)
        for (const [index, point] of points.entries()) {
          next[cellKey(point.row, point.col)] = entry.answer[index]
        }
      }
      return next
    })
    setAnswers(Object.fromEntries(puzzle.entries.map((e) => [e.id, e.answer])))
    setScore(scoreCrosswordAnswers(
      Object.fromEntries(puzzle.entries.map((e) => [e.id, e.answer])),
      puzzle,
    ))
  }

  const across = (puzzle?.entries?.filter((entry) => entry.direction === 'across') ?? [])
    .slice()
    .sort((a, b) => (a.number ?? 0) - (b.number ?? 0))
  const down = (puzzle?.entries?.filter((entry) => entry.direction === 'down') ?? [])
    .slice()
    .sort((a, b) => (a.number ?? 0) - (b.number ?? 0))

  return (
    <section className="relative">
      {/* Level Selection Modal */}
      {showLevelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border-2 border-amber-200 bg-white p-6 shadow-xl">
            <h2 className="mb-2 text-xl font-bold text-slate-800">Choose difficulty</h2>
            <p className="mb-5 text-sm text-slate-500">Nora will generate a fresh puzzle for the level you pick.</p>
            <div className="grid gap-3">
              {CROSSWORD_LEVELS.map((l) => {
                const meta = LEVEL_META[l]
                return (
                  <button
                    key={l}
                    onClick={() => {
                      setLevel(l)
                      startPuzzle(l)
                    }}
                    className="group flex flex-col rounded-xl border-2 border-slate-200 bg-white p-4 text-left transition hover:border-cyan-400 hover:bg-cyan-50"
                  >
                    <span className="text-base font-bold text-slate-800 group-hover:text-cyan-700">{meta.label}</span>
                    <span className="mt-0.5 text-xs text-slate-500">{meta.detail}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-slate-800">Crossword</h1>
          <p className="text-xs text-slate-500">
            Level: <span className="font-semibold text-slate-700">{LEVEL_META[level]?.label ?? level}</span>
            {!aiSource && puzzle && <span className="ml-2 italic text-slate-400">local puzzle</span>}
          </p>
        </div>
        {score && (
          <div className="text-right">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Score</p>
            <p className="text-base font-bold text-slate-800">{score.correct}/{score.total}</p>
          </div>
        )}
      </div>

      {/* Grid */}
      <div className="relative rounded-2xl border-2 border-amber-200 bg-amber-50 p-4 shadow-inner">
        {puzzle ? (
          <div
            className="mx-auto inline-grid gap-[1px] rounded-md border-2 border-slate-700 bg-slate-700 p-[1px]"
            style={{
              gridTemplateColumns: `repeat(${puzzle.dimensions.cols}, minmax(1.75rem, 2.25rem))`,
              width: 'fit-content',
            }}
          >
            {Array.from({ length: puzzle.dimensions.rows }).flatMap((_, row) =>
              Array.from({ length: puzzle.dimensions.cols }).map((__, col) => {
                const key = cellKey(row, col)
                const active = activeCells.has(key)

                if (!active) {
                  return <div key={key} className="h-7 w-7 bg-slate-700 sm:h-9 sm:w-9" />
                }

                const startEntry = puzzle.entries.find((e) => e.row === row && e.col === col)

                return (
                  <div key={key} className="relative h-7 w-7 bg-white sm:h-9 sm:w-9">
                    {startEntry && (
                      <span className="absolute left-0.5 top-0.5 z-10 text-[9px] font-bold leading-none text-slate-500 sm:text-[10px]">
                        {startEntry.number ?? startEntry.id}
                      </span>
                    )}
                    <input
                      value={cells[key] || ''}
                      onChange={(event) => applyCellValue(row, col, event.target.value)}
                      disabled={loading}
                      autoComplete="off"
                      className="absolute inset-0 h-full w-full bg-transparent text-center text-sm font-bold uppercase text-slate-800 focus:bg-cyan-100 focus:outline-none sm:text-lg"
                      maxLength={1}
                    />
                  </div>
                )
              })
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center p-12 text-sm text-slate-400">
            Pick a difficulty to begin.
          </div>
        )}

        {/* Loading overlay – preserves the previous grid behind it */}
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-amber-50/80 backdrop-blur-sm">
            <div className="flex items-center gap-3 rounded-full border border-amber-200 bg-white px-4 py-2 text-sm font-bold text-amber-700 shadow">
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              Nora is generating a puzzle…
            </div>
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          onClick={onCheck}
          disabled={!puzzle || loading}
          className="rounded-xl border border-cyan-300 bg-cyan-50 px-4 py-2 text-sm font-bold text-cyan-700 transition hover:bg-cyan-100 disabled:opacity-40"
        >
          Check
        </button>
        <button
          onClick={onReveal}
          disabled={!puzzle || loading}
          className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-40"
        >
          Reveal
        </button>
        <button
          onClick={onNewPuzzle}
          disabled={loading}
          className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-40"
        >
          New puzzle
        </button>
      </div>

      {score && !score.solved && (
        <p className="mt-3 text-xs text-slate-500">
          {score.correct} of {score.total} correct. Keep going!
        </p>
      )}
      {score?.solved && (
        <p className="mt-3 text-sm font-bold text-emerald-600">Solved! Nice work.</p>
      )}

      {/* Clues – moved below the grid */}
      {puzzle && (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border-2 border-slate-200 bg-white p-4">
            <h2 className="mb-2 text-sm font-bold uppercase tracking-wider text-slate-500">Across</h2>
            <ul className="space-y-1.5 text-sm text-slate-700">
              {across.map((entry) => (
                <li key={entry.id} className="flex gap-2">
                  <span className="w-6 flex-shrink-0 font-bold text-slate-500">{entry.number ?? entry.id}.</span>
                  <span>{entry.clue}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border-2 border-slate-200 bg-white p-4">
            <h2 className="mb-2 text-sm font-bold uppercase tracking-wider text-slate-500">Down</h2>
            <ul className="space-y-1.5 text-sm text-slate-700">
              {down.map((entry) => (
                <li key={entry.id} className="flex gap-2">
                  <span className="w-6 flex-shrink-0 font-bold text-slate-500">{entry.number ?? entry.id}.</span>
                  <span>{entry.clue}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {burst.map((particle) => (
        <span
          key={particle.id}
          className="pointer-events-none fixed animate-ping rounded-full bg-cyan-400/50"
          style={{
            left: `${particle.left}%`,
            top: `${particle.top}%`,
            width: `${particle.size}px`,
            height: `${particle.size}px`,
            animationDelay: `${particle.delayMs}ms`,
            zIndex: 100,
          }}
        />
      ))}
    </section>
  )
}
