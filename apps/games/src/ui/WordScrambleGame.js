'use client'

import { useEffect, useState, useCallback } from 'react'
import { createBurstParticles, playArcadeEffect } from './arcadeFx'
import { SCRAMBLE_LEVELS, pickScrambleRound } from '../index.js'

async function fetchWordFromAI(level) {
  const res = await fetch('/api/nora-word', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ level }),
    signal: AbortSignal.timeout(20000),
  })
  if (!res.ok) throw new Error('ai_unavailable')
  const json = await res.json()
  if (json.error || !json.word) throw new Error(json.error || 'bad_word')
  return json
}

function shuffle(word) {
  const arr = word.split('')
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr.join('')
}

export default function WordScrambleGame() {
  const [level, setLevel] = useState('elementary')
  const [current, setCurrent] = useState(null)
  const [scrambled, setScrambled] = useState('')
  const [input, setInput] = useState('')
  const [score, setScore] = useState(0)
  const [round, setRound] = useState(0)
  const [gameState, setGameState] = useState('idle') // idle, playing, won, finished
  const [message, setMessage] = useState('')
  const [burst, setBurst] = useState([])
  const [loading, setLoading] = useState(false)
  const [showLevelModal, setShowLevelModal] = useState(true)

  const celebrate = (effect = 'success') => {
    playArcadeEffect(effect)
    setBurst(createBurstParticles(14))
    setTimeout(() => setBurst([]), 520)
  }

  const nextRound = useCallback(async (chosenLevel = level) => {
    if (round >= 5) {
      setGameState('finished')
      return
    }
    
    setLoading(true)
    setMessage('')
    
    let pick
    try {
      pick = await fetchWordFromAI(chosenLevel)
    } catch {
      pick = pickScrambleRound(chosenLevel)
    }
    
    setCurrent(pick)
    setScrambled(shuffle(pick.word))
    setInput('')
    setRound(r => r + 1)
    setGameState('playing')
    setLoading(false)
    playArcadeEffect('tap')
  }, [round, level])

  const check = () => {
    if (input.toUpperCase() === current.word) {
      setScore(s => s + 100)
      setMessage(`🌟 Correct! It was ${current.word}! +100`)
      setGameState('won')
      celebrate('success')
    } else {
      setMessage('❌ Not quite, try again!')
      playArcadeEffect('fail')
    }
  }

  const start = (chosenLevel) => {
    setLevel(chosenLevel)
    setScore(0)
    setRound(0)
    setShowLevelModal(false)
    playArcadeEffect('start')
    nextRound(chosenLevel)
  }

  if (showLevelModal) {
    return (
      <div className="flex flex-col items-center py-12">
        <h2 className="text-4xl font-black text-rose-600 mb-6">🔠 Word Scramble</h2>
        <div className="w-full max-w-md rounded-2xl border-2 border-rose-200 bg-white p-6 shadow-xl text-center">
            <h3 className="mb-2 text-xl font-bold text-slate-800">Choose difficulty</h3>
            <p className="mb-5 text-sm text-slate-500">How hard should the words be?</p>
            <div className="grid gap-3">
              {SCRAMBLE_LEVELS.map((l) => {
                const meta = {
                  elementary: { label: 'Elementary', detail: 'Short common words' },
                  middleschool: { label: 'Middle School', detail: 'Themed words' },
                  highschool: { label: 'High School', detail: 'Advanced vocabulary' },
                }[l]
                return (
                  <button
                    key={l}
                    onClick={() => start(l)}
                    className="group flex flex-col rounded-xl border-2 border-slate-200 bg-white p-4 text-left transition hover:border-rose-400 hover:bg-rose-50"
                  >
                    <span className="text-base font-bold text-slate-800 group-hover:text-rose-700">{meta.label}</span>
                    <span className="mt-0.5 text-xs text-slate-500">{meta.detail}</span>
                  </button>
                )
              })}
            </div>
          </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center py-20 gap-4">
        <span className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-rose-500 border-t-transparent" />
        <p className="text-xl font-bold text-rose-600 animate-pulse">Nora is scrambling a word...</p>
      </div>
    )
  }

  if (gameState === 'finished') {
    return (
      <div className="flex flex-col items-center py-12">
        <h2 className="text-4xl font-black text-slate-800">Game Over!</h2>
        <p className="mt-4 text-xl font-bold">Your Total Score: <span className="text-rose-600">{score}</span></p>
        <button onClick={() => setShowLevelModal(true)} className="mt-8 rounded-2xl bg-slate-900 px-8 py-4 text-xl font-bold text-white shadow-lg hover:bg-slate-800">
          Play Again
        </button>
      </div>
    )
  }

  return (
    <div className="relative flex flex-col items-center rounded-3xl border-2 border-rose-200 bg-gradient-to-b from-rose-50 via-white to-amber-50 p-4 shadow-lg">
      {burst.map((particle) => (
        <span
          key={particle.id}
          className="pointer-events-none absolute animate-ping rounded-full bg-rose-300/80"
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
      <div className="flex w-full justify-between items-center mb-8">
        <div className="rounded-xl bg-rose-100 px-4 py-1 text-sm font-bold text-rose-600">Round {round}/5 • {level}</div>
        <div className="text-2xl font-black text-slate-800">Score: {score}</div>
      </div>

      <div className="mb-6 rounded-3xl bg-slate-50 border-4 border-dashed border-slate-200 p-6 sm:p-8 text-center w-full max-w-xs sm:max-w-sm">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Scrambled</p>
        <p className="text-3xl sm:text-5xl font-black tracking-widest text-indigo-600 font-mono truncate">{scrambled}</p>
      </div>

      <p className="mb-6 sm:mb-8 text-slate-500 font-bold italic text-sm sm:text-base px-2 truncate">
        <span className="text-xl sm:text-2xl mr-1 sm:mr-2">{current.mascot}</span>
        💡 Hint: {current.hint}
      </p>

      {gameState === 'playing' ? (
        <div className="flex w-full gap-2 max-w-xs sm:max-w-sm">
          <input
            autoFocus
            value={input}
            onChange={(e) => setInput(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === 'Enter' && check()}
            className="flex-[2] rounded-2xl border-4 border-slate-200 px-3 py-2 sm:p-4 text-center text-lg sm:text-2xl font-black uppercase outline-none focus:border-rose-400 min-w-0"
            placeholder="???"
          />
          <button onClick={check} className="rounded-2xl bg-rose-500 px-4 py-2 sm:px-6 font-bold text-sm sm:text-base text-white flex-shrink-0">Go</button>
        </div>
      ) : (
        <div className="text-center">
          <p className="text-2xl font-black text-emerald-600 mb-6">{message}</p>
          <button onClick={() => nextRound(level)} className="rounded-2xl bg-slate-900 px-8 py-4 font-bold text-white shadow-lg">Next Word</button>
        </div>
      )}
      {message.includes('❌') && <p className="mt-4 text-rose-500 font-bold">{message}</p>}
    </div>
  )
}
