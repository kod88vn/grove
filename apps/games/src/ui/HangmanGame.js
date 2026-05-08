'use client'

import { useState } from 'react'
import { pickHangmanRound } from '../index.js'

const HANGMAN_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

function HangmanVisual({ wrongCount }) {
  // Parts of the hangman: 1. Head, 2. Body, 3. Left Arm, 4. Right Arm, 5. Left Leg, 6. Right Leg, 7. Face
  const parts = [
    // Head (wrongCount >= 1)
    <circle key="head" cx="140" cy="80" r="20" className="fill-none stroke-current" strokeWidth="4" />,
    // Body (wrongCount >= 2)
    <line key="body" x1="140" y1="100" x2="140" y2="150" className="stroke-current" strokeWidth="4" />,
    // Left Arm (wrongCount >= 3)
    <line key="l-arm" x1="140" y1="115" x2="115" y2="135" className="stroke-current" strokeWidth="4" />,
    // Right Arm (wrongCount >= 4)
    <line key="r-arm" x1="140" y1="115" x2="165" y2="135" className="stroke-current" strokeWidth="4" />,
    // Left Leg (wrongCount >= 5)
    <line key="l-leg" x1="140" y1="150" x2="115" y2="185" className="stroke-current" strokeWidth="4" />,
    // Right Leg (wrongCount >= 6)
    <line key="r-leg" x1="140" y1="150" x2="165" y2="185" className="stroke-current" strokeWidth="4" />,
    // Face (wrongCount >= 7)
    <g key="face" className="stroke-current" strokeWidth="2">
      <line x1="133" y1="75" x2="137" y2="80" />
      <line x1="137" y1="75" x2="133" y2="80" />
      <line x1="143" y1="75" x2="147" y2="80" />
      <line x1="147" y1="75" x2="143" y2="80" />
      <path d="M 134 88 Q 140 85 146 88" className="fill-none" />
    </g>,
  ]

  return (
    <div className="flex justify-center p-2">
      <svg width="200" height="220" viewBox="0 0 200 220" className="text-slate-800">
        {/* Gallows */}
        <line x1="20" y1="200" x2="100" y2="200" className="stroke-current" strokeWidth="4" />
        <line x1="60" y1="200" x2="60" y2="20" className="stroke-current" strokeWidth="4" />
        <line x1="60" y1="20" x2="140" y2="20" className="stroke-current" strokeWidth="4" />
        <line x1="140" y1="20" x2="140" y2="60" className="stroke-current" strokeWidth="2" />
        {/* Hangman parts */}
        {parts.slice(0, wrongCount)}
      </svg>
    </div>
  )
}

export default function HangmanGame() {
  const [round, setRound] = useState(() => pickHangmanRound())
  const [guessed, setGuessed] = useState(() => new Set())
  const [wrongCount, setWrongCount] = useState(0)

  const letters = round.word.split('')
  const uniqueLetters = new Set(letters)
  const isWon = Array.from(uniqueLetters).every((letter) => guessed.has(letter))
  const isLost = wrongCount >= 7

  const maskedWord = letters.map((letter) => (guessed.has(letter) || isLost ? letter : '_')).join(' ')

  const onGuess = (letter) => {
    if (isWon || isLost || guessed.has(letter)) {
      return
    }

    setGuessed((previous) => new Set(previous).add(letter))
    if (!letters.includes(letter)) {
      setWrongCount((previous) => previous + 1)
    }
  }

  const onNewRound = () => {
    setRound(pickHangmanRound())
    setGuessed(new Set())
    setWrongCount(0)
  }

  return (
    <section>
      <div className="flex flex-col gap-6 md:flex-row">
        <div className="flex-1 rounded-2xl border-2 border-amber-200 bg-amber-50 p-6 flex flex-col justify-center shadow-inner">
          <p className="inline-flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-amber-800">
            <span className="text-xl">{round.mascot}</span> Hint: {round.hint}
          </p>
          <div className="my-8 flex justify-center">
            <p className="break-words font-mono text-4xl font-black tracking-[0.4em] text-slate-800 transition-all">
              {maskedWord}
            </p>
          </div>
          <div className="mt-auto flex items-center justify-between border-t border-amber-200/50 pt-4">
            <p className="text-sm font-bold text-slate-700">
              Chances Left: <span className={wrongCount >= 5 ? 'text-rose-600' : 'text-cyan-600'}>{7 - wrongCount}</span>
            </p>
            <p className="text-xs font-medium text-slate-500 italic">Get the letters right to save the day!</p>
          </div>
        </div>

        <div className="w-full md:w-48 flex-shrink-0 rounded-2xl border-2 border-slate-200 bg-white shadow-sm flex items-center justify-center p-2">
          <HangmanVisual wrongCount={wrongCount} />
        </div>
      </div>

      <div className="mt-8 grid grid-cols-7 gap-2 sm:grid-cols-9 md:grid-cols-13">
        {HANGMAN_ALPHABET.map((letter) => {
          const disabled = guessed.has(letter) || isWon || isLost
          return (
            <button
              key={letter}
              type="button"
              onClick={() => onGuess(letter)}
              disabled={disabled}
              className="rounded-xl border border-slate-300 bg-white px-2 py-2 text-sm font-bold text-slate-700 transition hover:scale-105 hover:bg-cyan-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {letter}
            </button>
          )
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {isWon && <p className="rounded-full bg-emerald-100 px-4 py-2 text-sm font-bold text-emerald-700">🎉 You saved the word!</p>}
        {isLost && (
          <p className="rounded-full bg-rose-100 px-4 py-2 text-sm font-bold text-rose-700">😅 Oops! The word was {round.word}.</p>
        )}
        <button
          type="button"
          onClick={onNewRound}
          className="rounded-full bg-slate-900 px-4 py-2 text-sm font-bold text-white transition hover:bg-slate-700"
        >
          New Word
        </button>
      </div>
    </section>
  )
}
