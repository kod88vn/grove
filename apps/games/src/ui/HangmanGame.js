'use client'

import { useCallback, useEffect, useState } from 'react'
import { HANGMAN_LEVELS, pickHangmanRound } from '../index.js'

async function fetchWordFromAI(level) {
  const res = await fetch('/api/nora-word', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ level }),
    signal: AbortSignal.timeout(7000),
  })
  if (!res.ok) throw new Error('ai_unavailable')
  const json = await res.json()
  if (json.error || !json.word) throw new Error(json.error || 'bad_word')
  return json
}

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
  const [level, setLevel] = useState('elementary')
  const [round, setRound] = useState(null)
  const [guessed, setGuessed] = useState(new Set())
  const [wrongCount, setWrongCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [aiSource, setAiSource] = useState(false)
  const [showLevelModal, setShowLevelModal] = useState(true)

  const startRound = useCallback(async (chosenLevel) => {
    setLoading(true)
    setGuessed(new Set())
    setWrongCount(0)
    try {
      const word = await fetchWordFromAI(chosenLevel)
      setRound(word)
      setAiSource(true)
    } catch {
      setRound(pickHangmanRound(chosenLevel))
      setAiSource(false)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // Do not auto-start; wait for user to pick level
  }, [])

  const onStartLevel = (chosenLevel) => {
    setShowLevelModal(false)
    setLevel(chosenLevel)
    startRound(chosenLevel)
  }

  const letters = round?.word?.split('') ?? []
  const uniqueLetters = new Set(letters)
  const isWon = letters.length > 0 && Array.from(uniqueLetters).every((letter) => guessed.has(letter))
  const isLost = wrongCount >= 7
  const wrongGuesses = Array.from(guessed).filter((letter) => !letters.includes(letter)).sort()

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
    startRound(level)
  }

  const onLevelChange = (nextLevel) => {
    setLevel(nextLevel)
    startRound(nextLevel)
  }

  useEffect(() => {
    const onKeyDown = (event) => {
      if (loading || !round || isWon || isLost) {
        return
      }

      const key = String(event.key || '').toUpperCase()
      if (!/^[A-Z]$/.test(key)) {
        return
      }

      event.preventDefault()
      onGuess(key)
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [loading, round, isWon, isLost, onGuess])

  return (
    <section>
      {showLevelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border-2 border-amber-200 bg-white p-6 shadow-xl">
            <h2 className="mb-2 text-xl font-bold text-slate-800">Choose difficulty</h2>
            <p className="mb-5 text-sm text-slate-500">Nora will pick a word for the level you choose.</p>
            <div className="grid gap-3">
              {HANGMAN_LEVELS.map((l) => {
                const meta = {
                  elementary: { label: 'Elementary', detail: 'Short common words' },
                  middleschool: { label: 'Middle School', detail: 'Themed words' },
                  highschool: { label: 'High School', detail: 'Advanced vocabulary' },
                }[l]
                return (
                  <button
                    key={l}
                    onClick={() => onStartLevel(l)}
                    className="group flex flex-col rounded-xl border-2 border-slate-200 bg-white p-4 text-left transition hover:border-amber-400 hover:bg-amber-50"
                  >
                    <span className="text-base font-bold text-slate-800 group-hover:text-amber-700">{meta.label}</span>
                    <span className="mt-0.5 text-xs text-slate-500">{meta.detail}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center gap-3 rounded-2xl border-2 border-amber-200 bg-amber-50 p-10 text-amber-700">
          <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
          <span className="text-sm font-bold">Nora is thinking of a word…</span>
        </div>
      )}

      {!loading && round && (
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
            {!aiSource && <p className="text-xs text-slate-400 italic">local word</p>}
          </div>
        </div>

        <div className="w-full md:w-48 flex-shrink-0 rounded-2xl border-2 border-slate-200 bg-white shadow-sm flex items-center justify-center p-2">
          <HangmanVisual wrongCount={wrongCount} />
        </div>
      </div>
      )}

      {!loading && round && (
        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <span className="font-semibold">Keyboard:</span>
          <span>Type A-Z to guess letters.</span>
        </div>
      )}

      <div className="mt-8 grid grid-cols-7 gap-2 sm:grid-cols-9 md:grid-cols-13">
        {HANGMAN_ALPHABET.map((letter) => {
          const disabled = loading || !round || guessed.has(letter) || isWon || isLost
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

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {HANGMAN_LEVELS.map((option) => {
          const active = option === level
          return (
            <button
              key={option}
              type="button"
              onClick={() => onLevelChange(option)}
              disabled={loading}
              className={`rounded-full border px-3 py-1 text-xs font-black uppercase tracking-wide transition disabled:opacity-50 ${
                active
                  ? 'border-cyan-600 bg-cyan-600 text-white'
                  : 'border-slate-300 bg-white text-slate-700 hover:border-cyan-500 hover:text-cyan-700'
              }`}
            >
              {option === 'middleschool' ? 'Middle School' : option}
            </button>
          )
        })}
      </div>

      {!loading && round && wrongGuesses.length > 0 && (
        <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3">
          <p className="text-xs font-bold uppercase tracking-wide text-rose-700">Tried and missed</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {wrongGuesses.map((letter) => (
              <span
                key={letter}
                className="rounded-full border border-rose-300 bg-white px-2 py-1 text-xs font-bold text-rose-700"
              >
                {letter}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {isWon && <p className="rounded-full bg-emerald-100 px-4 py-2 text-sm font-bold text-emerald-700">🎉 You saved the word!</p>}
        {isLost && round && (
          <p className="rounded-full bg-rose-100 px-4 py-2 text-sm font-bold text-rose-700">😅 Oops! The word was {round.word}.</p>
        )}
        <button
          type="button"
          onClick={onNewRound}
          disabled={loading}
          className="rounded-full bg-slate-900 px-4 py-2 text-sm font-bold text-white transition hover:bg-slate-700 disabled:opacity-50"
        >
          {loading ? 'Loading…' : 'New Word'}
        </button>
      </div>
    </section>
  )
}
