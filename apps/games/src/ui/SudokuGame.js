'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  SUDOKU_LEVELS,
  cloneMiniSudokuBoard,
  coordKey,
  getSudokuBlockDims,
  isMiniSudokuPlacementValid,
  isMiniSudokuSolved,
  pickSudokuPuzzle,
} from '../index.js'

const LEVEL_META = {
  elementary: { label: 'Elementary', detail: '4×4 mini grid · more clues' },
  middleschool: { label: 'Middle School', detail: '6×6 grid · balanced clues' },
  highschool: { label: 'High School', detail: '9×9 classic · fewer clues' },
}

export default function SudokuGame() {
  const [level, setLevel] = useState('elementary')
  const [puzzle, setPuzzle] = useState(null)
  const [board, setBoard] = useState(null)
  const [showLevelModal, setShowLevelModal] = useState(true)

  const startPuzzle = useCallback((chosenLevel) => {
    setShowLevelModal(false)
    setLevel(chosenLevel)
    const nextPuzzle = pickSudokuPuzzle(chosenLevel)
    setPuzzle(nextPuzzle)
    setBoard(cloneMiniSudokuBoard(nextPuzzle.board))
  }, [])

  useEffect(() => {
    // Do not auto-start; wait for user to pick level
  }, [])

  const onStartLevel = (chosenLevel) => {
    startPuzzle(chosenLevel)
  }

  const onNewPuzzle = () => {
    setShowLevelModal(true)
  }

  const solved = useMemo(() => board && isMiniSudokuSolved(board), [board])
  const size = puzzle?.size ?? 4
  const blockRows = puzzle?.blockRows ?? getSudokuBlockDims(size).blockRows
  const blockCols = puzzle?.blockCols ?? getSudokuBlockDims(size).blockCols

  const setCell = (row, col, valueText) => {
    if (!puzzle || puzzle.board[row][col] !== 0) {
      return
    }

    const raw = String(valueText || '').replace(/\D/g, '').slice(-1)
    const value = raw === '' ? 0 : Number(raw)
    const accepted = value >= 1 && value <= size ? value : 0

    setBoard((previous) => {
      const next = cloneMiniSudokuBoard(previous)
      next[row][col] = accepted
      return next
    })
  }

  const reset = () => {
    if (!puzzle) return
    setBoard(cloneMiniSudokuBoard(puzzle.board))
  }

  // Cell sizing scales down for larger grids so 9x9 fits nicely on mobile.
  const cellSize =
    size === 4 ? 'h-14 w-14 text-2xl' : size === 6 ? 'h-11 w-11 text-xl' : 'h-9 w-9 text-base'

  return (
    <section>
      {showLevelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border-2 border-violet-200 bg-white p-6 shadow-xl">
            <h2 className="mb-2 text-xl font-bold text-slate-800">Choose difficulty</h2>
            <p className="mb-5 text-sm text-slate-500">Each level uses a different grid size.</p>
            <div className="grid gap-3">
              {SUDOKU_LEVELS.map((l) => {
                const meta = LEVEL_META[l]
                return (
                  <button
                    key={l}
                    onClick={() => onStartLevel(l)}
                    className="group flex flex-col rounded-xl border-2 border-slate-200 bg-white p-4 text-left transition hover:border-violet-400 hover:bg-violet-50"
                  >
                    <span className="text-base font-bold text-slate-800 group-hover:text-violet-700">{meta.label}</span>
                    <span className="mt-0.5 text-xs text-slate-500">{meta.detail}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {puzzle && board && (
      <>
      <p className="mb-4 rounded-xl bg-violet-100 px-4 py-3 text-sm font-semibold text-violet-800">
        🧠 Fill numbers 1–{size} so each row, column, and {blockRows}×{blockCols} block has every number exactly once.
      </p>

      <div className="mx-auto w-fit">
        <div className="game-grid overflow-x-auto">
          <div
            className="grid gap-1 rounded-2xl bg-slate-900 p-2 mx-auto"
            style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }}
          >
          {board.map((row, rowIndex) =>
            row.map((value, colIndex) => {
              const locked = puzzle.board[rowIndex][colIndex] !== 0
              const valid = !value || isMiniSudokuPlacementValid(board, rowIndex, colIndex, value)
              const blockTone =
                (Math.floor(rowIndex / blockRows) + Math.floor(colIndex / blockCols)) % 2 === 0
                  ? 'bg-amber-50'
                  : 'bg-sky-50'

              return (
                <input
                  key={coordKey(rowIndex, colIndex)}
                  inputMode="numeric"
                  maxLength={1}
                  value={value || ''}
                  disabled={locked}
                  onChange={(event) => setCell(rowIndex, colIndex, event.target.value)}
                  className={`${blockTone} ${cellSize} rounded-lg border-2 text-center font-black outline-none ${
                    locked
                      ? 'border-slate-300 text-slate-900'
                      : valid
                      ? 'border-cyan-300 text-cyan-900 focus:border-cyan-500'
                      : 'border-rose-400 text-rose-700 focus:border-rose-500'
                  }`}
                />
              )
            })
          )}
        </div>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-3">
        {solved ? (
          <p className="rounded-full bg-emerald-100 px-4 py-2 text-sm font-bold text-emerald-700">🌟 Sudoku solved!</p>
        ) : (
          <p className="text-sm font-semibold text-slate-700">Keep going, puzzle hero.</p>
        )}
        <button
          type="button"
          onClick={reset}
          className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-100"
        >
          Reset
        </button>
        <button
          type="button"
          onClick={onNewPuzzle}
          className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-100"
        >
          New Puzzle
        </button>
      </div>
      </>
      )}
    </section>
  )
}
