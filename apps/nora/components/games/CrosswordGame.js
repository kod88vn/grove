'use client'

import { useMemo, useState } from 'react'
import { CROSSWORD_PUZZLE, scoreCrosswordAnswers } from '@/lib/modules/games'
import { createBurstParticles, playArcadeEffect } from '@/components/games/arcadeFx'

function cellKey(row, col) {
  return `${row},${col}`
}

function getEntryCells(entry) {
  return Array.from({ length: entry.answer.length }, (_, offset) => ({
    row: entry.row + (entry.direction === 'down' ? offset : 0),
    col: entry.col + (entry.direction === 'across' ? offset : 0),
  }))
}

export default function CrosswordGame() {
  const [answers, setAnswers] = useState({})
  const [cells, setCells] = useState({})
  const [score, setScore] = useState(null)
  const [burst, setBurst] = useState([])

  const entryCells = useMemo(
    () => Object.fromEntries(CROSSWORD_PUZZLE.entries.map((entry) => [entry.id, getEntryCells(entry)])),
    []
  )

  const activeCells = useMemo(() => {
    const all = new Set()
    for (const entry of CROSSWORD_PUZZLE.entries) {
      for (const point of entryCells[entry.id]) {
        all.add(cellKey(point.row, point.col))
      }
    }
    return all
  }, [entryCells])

  const celebrate = (effect) => {
    playArcadeEffect(effect)
    setBurst(createBurstParticles(14))
    setTimeout(() => setBurst([]), 520)
  }

  const applyEntryText = (entry, value) => {
    const normalized = String(value || '')
      .toUpperCase()
      .replace(/[^A-Z]/g, '')
      .slice(0, entry.answer.length)

    setAnswers((previous) => ({ ...previous, [entry.id]: normalized }))
    setCells((previous) => {
      const next = { ...previous }
      for (const [index, point] of entryCells[entry.id].entries()) {
        next[cellKey(point.row, point.col)] = normalized[index] || ''
      }
      return next
    })
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
        for (const entry of CROSSWORD_PUZZLE.entries) {
          const points = entryCells[entry.id]
          const touchesEditedCell = points.some((point) => point.row === row && point.col === col)
          if (!touchesEditedCell) {
            continue
          }

          updated[entry.id] = points.map((point) => next[cellKey(point.row, point.col)] || '').join('')
        }
        return updated
      })

      return next
    })
  }

  const onCheck = () => {
    const result = scoreCrosswordAnswers(answers)
    setScore(result)
    if (result.solved) {
      celebrate('win')
    } else if (result.correct > 0) {
      celebrate('success')
    } else {
      playArcadeEffect('fail')
    }
  }

  const across = CROSSWORD_PUZZLE.entries.filter((entry) => entry.direction === 'across')
  const down = CROSSWORD_PUZZLE.entries.filter((entry) => entry.direction === 'down')

  return (
    <section className="relative rounded-3xl border-2 border-cyan-200 bg-gradient-to-b from-cyan-50 via-white to-sky-50 p-4 shadow-lg">
      {burst.map((particle) => (
        <span
          key={particle.id}
          className="pointer-events-none absolute animate-ping rounded-full bg-cyan-300/80"
          style={{
            left: `${particle.left}%`,
            top: `${particle.top}%`,
            width: `${particle.size}px`,
            height: `${particle.size}px`,
            animationDelay: `${particle.delayMs}ms`,
            animationDuration: '520ms',
          }}
        />
      ))}
      <p className="mb-4 rounded-xl bg-sky-100 px-4 py-3 text-sm font-semibold text-sky-800">
        🧩 Type each answer and fill the mini grid. Shared letters help solve crossing clues.
      </p>

      <div className="grid gap-5 lg:grid-cols-[auto,1fr]">
        <div className="inline-grid gap-1 rounded-2xl bg-slate-900 p-2" style={{ gridTemplateColumns: `repeat(${CROSSWORD_PUZZLE.dimensions.cols}, minmax(0, 2.2rem))` }}>
          {Array.from({ length: CROSSWORD_PUZZLE.dimensions.rows }).flatMap((_, row) =>
            Array.from({ length: CROSSWORD_PUZZLE.dimensions.cols }).map((__, col) => {
              const key = cellKey(row, col)
              const active = activeCells.has(key)

              if (!active) {
                return <div key={key} className="h-9 w-9 rounded-md bg-slate-800" />
              }

              return (
                <input
                  key={key}
                  value={cells[key] || ''}
                  onChange={(event) => applyCellValue(row, col, event.target.value)}
                  className="h-9 w-9 rounded-md border-2 border-cyan-200 bg-white text-center text-lg font-black uppercase text-cyan-900 outline-none transition focus:border-cyan-500"
                  maxLength={1}
                  inputMode="text"
                  aria-label={`Crossword cell ${row + 1}-${col + 1}`}
                />
              )
            })
          )}
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-700">Across</p>
            {across.map((entry) => (
              <label key={entry.id} className="mt-3 block">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">{entry.id}</p>
                <p className="mt-1 text-sm font-semibold text-slate-800">{entry.clue}</p>
                <input
                  value={answers[entry.id] || ''}
                  onChange={(event) => applyEntryText(entry, event.target.value)}
                  className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold uppercase tracking-wide text-slate-800 outline-none ring-cyan-400 focus:ring-2"
                  placeholder="Type answer"
                />
              </label>
            ))}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-700">Down</p>
            {down.map((entry) => (
              <label key={entry.id} className="mt-3 block">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">{entry.id}</p>
                <p className="mt-1 text-sm font-semibold text-slate-800">{entry.clue}</p>
                <input
                  value={answers[entry.id] || ''}
                  onChange={(event) => applyEntryText(entry, event.target.value)}
                  className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold uppercase tracking-wide text-slate-800 outline-none ring-cyan-400 focus:ring-2"
                  placeholder="Type answer"
                />
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={onCheck}
          className="rounded-full bg-cyan-700 px-5 py-2 text-sm font-bold text-white transition hover:bg-cyan-800"
        >
          Check Answers
        </button>
        {score && (
          <p className="text-sm font-bold text-slate-700">
            {score.solved ? '🥳 Perfect!' : '💡 Keep going!'} {score.correct}/{score.total} correct.
          </p>
        )}
      </div>
    </section>
  )
}
