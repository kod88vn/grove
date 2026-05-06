'use client'

import { useState } from 'react'
import { MINI_SUDOKU_PUZZLE, cloneMiniSudokuBoard, coordKey, isMiniSudokuPlacementValid, isMiniSudokuSolved } from '@/lib/modules/games'

export default function SudokuGame() {
  const [board, setBoard] = useState(() => cloneMiniSudokuBoard(MINI_SUDOKU_PUZZLE.board))

  const solved = useMemo(() => isMiniSudokuSolved(board), [board])

  const setCell = (row, col, valueText) => {
    if (MINI_SUDOKU_PUZZLE.board[row][col] !== 0) {
      return
    }

    const value = Number(valueText)
    setBoard((previous) => {
      const next = cloneMiniSudokuBoard(previous)
      next[row][col] = [1, 2, 3, 4].includes(value) ? value : 0
      return next
    })
  }

  const reset = () => {
    setBoard(cloneMiniSudokuBoard(MINI_SUDOKU_PUZZLE.board))
  }

  return (
    <section>
      <p className="mb-4 rounded-xl bg-violet-100 px-4 py-3 text-sm font-semibold text-violet-800">
        🧠 Fill numbers 1-4 so each row, column, and 2x2 block has all numbers exactly once.
      </p>

      <div className="inline-grid grid-cols-4 gap-1 rounded-2xl bg-slate-900 p-2">
        {board.map((row, rowIndex) =>
          row.map((value, colIndex) => {
            const locked = MINI_SUDOKU_PUZZLE.board[rowIndex][colIndex] !== 0
            const valid = !value || isMiniSudokuPlacementValid(board, rowIndex, colIndex, value)
            const blockTone = (Math.floor(rowIndex / 2) + Math.floor(colIndex / 2)) % 2 === 0 ? 'bg-amber-50' : 'bg-sky-50'

            return (
              <input
                key={coordKey(rowIndex, colIndex)}
                inputMode="numeric"
                maxLength={1}
                value={value || ''}
                disabled={locked}
                onChange={(event) => setCell(rowIndex, colIndex, event.target.value)}
                className={`${blockTone} h-14 w-14 rounded-lg border-2 text-center text-2xl font-black outline-none ${
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
      </div>
    </section>
  )
}

import { useMemo } from 'react'
