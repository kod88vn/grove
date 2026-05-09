'use client'

import {
  GomokuGame,
  SudokuGame,
  HangmanGame,
  CrosswordGame,
  MathQuizGame,
  WordScrambleGame,
  MemoryGame,
  LogicCodeGame,
} from './ui'

export function ModuleGameArcade({ module }) {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#fde68a_0%,_#fca5a5_40%,_#bae6fd_100%)] px-4 py-8 md:px-6 md:py-10">
      <section className="mx-auto w-full max-w-5xl rounded-3xl border-4 border-white/60 bg-white/85 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.25)]">
        <header className="mb-6 rounded-2xl bg-gradient-to-r from-orange-300 via-rose-300 to-cyan-300 p-5 text-slate-900">
          <p className="text-xs font-bold uppercase tracking-[0.3em]">Nora Kids Arcade</p>
          <h1 className="mt-2 text-3xl font-black">{module.title}</h1>
          <p className="mt-2 max-w-3xl text-sm font-medium text-slate-800">{module.summary}</p>
        </header>

        {module.slug === 'hangman' && <HangmanGame />}
        {module.slug === 'crossword' && <CrosswordGame />}
        {module.slug === 'sudoku' && <SudokuGame />}
        {module.slug === 'gomoku' && <GomokuGame />}
        {module.slug === 'math-lightning' && <MathQuizGame />}
        {module.slug === 'word-scramble' && <WordScrambleGame />}
        {module.slug === 'memory-match' && <MemoryGame />}
        {module.slug === 'logic-code' && <LogicCodeGame />}
      </section>
    </main>
  )
}




