'use client'

import { useEffect, useState } from 'react'
import { createBurstParticles, playArcadeEffect } from './arcadeFx'

const WORDBANK = [
  { word: 'DRAGON', hint: 'Breaths fire!' },
  { word: 'PIZZA', hint: 'Cheesy triangle slice.' },
  { word: 'GIRAFFE', hint: 'Long necked spotted animal.' },
  { word: 'RAINBOW', hint: 'Seven colors in the sky.' },
  { word: 'BICYCLE', hint: 'Two wheels and pedals.' },
  { word: 'ROCKET', hint: 'Goes to the moon.' },
  { word: 'GARDEN', hint: 'Where flowers grow.' },
  { word: 'JUICE', hint: 'Fruit drink.' },
  { word: 'SCHOOL', hint: 'Where you go to learn.' },
  { word: 'WIZARD', hint: 'Wears a pointy hat and does magic.' },
]

function shuffle(word) {
  const arr = word.split('')
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr.join('')
}

export default function WordScrambleGame() {
  const [current, setCurrent] = useState(null)
  const [scrambled, setScrambled] = useState('')
  const [input, setInput] = useState('')
  const [score, setScore] = useState(0)
  const [round, setRound] = useState(0)
  const [gameState, setGameState] = useState('idle') // idle, playing, won, finished
  const [message, setMessage] = useState('')
  const [burst, setBurst] = useState([])

  const celebrate = (effect = 'success') => {
    playArcadeEffect(effect)
    setBurst(createBurstParticles(14))
    setTimeout(() => setBurst([]), 520)
  }

  const nextRound = () => {
    if (round >= 5) {
      setGameState('finished')
      return
    }
    const pick = WORDBANK[Math.floor(Math.random() * WORDBANK.length)]
    setCurrent(pick)
    setScrambled(shuffle(pick.word))
    setInput('')
    setRound(r => r + 1)
    setGameState('playing')
    setMessage('')
    playArcadeEffect('tap')
  }

  const check = () => {
    if (input.toUpperCase() === current.word) {
      setScore(s => s + 100)
      setMessage('🌟 Correct! +100')
      setGameState('won')
      celebrate('success')
    } else {
      setMessage('❌ Not quite, try again!')
      playArcadeEffect('fail')
    }
  }

  const start = () => {
    setScore(0)
    setRound(0)
    playArcadeEffect('start')
    nextRound()
  }

  if (gameState === 'idle') {
    return (
      <div className="flex flex-col items-center py-12">
        <h2 className="text-4xl font-black text-rose-600">🔠 Word Scramble</h2>
        <p className="mt-4 text-slate-600 font-bold">Unscramble the letters to find the hidden word!</p>
        <button onClick={start} className="mt-8 rounded-2xl bg-rose-500 px-8 py-4 text-xl font-bold text-white shadow-lg hover:bg-rose-600">
          Start Playing
        </button>
      </div>
    )
  }

  if (gameState === 'finished') {
    return (
      <div className="flex flex-col items-center py-12">
        <h2 className="text-4xl font-black text-slate-800">Game Over!</h2>
        <p className="mt-4 text-xl font-bold">Your Total Score: <span className="text-rose-600">{score}</span></p>
        <button onClick={start} className="mt-8 rounded-2xl bg-slate-900 px-8 py-4 text-xl font-bold text-white shadow-lg hover:bg-slate-800">
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
        <div className="rounded-xl bg-rose-100 px-4 py-1 text-sm font-bold text-rose-600">Round {round}/5</div>
        <div className="text-2xl font-black text-slate-800">Score: {score}</div>
      </div>

      <div className="mb-6 rounded-3xl bg-slate-50 border-4 border-dashed border-slate-200 p-8 text-center w-full max-w-sm">
        <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Scrambled</p>
        <p className="text-5xl font-black tracking-widest text-indigo-600 font-mono">{scrambled}</p>
      </div>

      <p className="mb-8 text-slate-500 font-bold italic">💡 Hint: {current.hint}</p>

      {gameState === 'playing' ? (
        <div className="flex w-full max-w-sm gap-2">
          <input
            autoFocus
            value={input}
            onChange={(e) => setInput(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === 'Enter' && check()}
            className="flex-1 rounded-2xl border-4 border-slate-200 p-4 text-center text-2xl font-black uppercase outline-none focus:border-rose-400"
            placeholder="???"
          />
          <button onClick={check} className="rounded-2xl bg-rose-500 px-6 font-bold text-white">Go</button>
        </div>
      ) : (
        <div className="text-center">
          <p className="text-2xl font-black text-emerald-600 mb-6">{message}</p>
          <button onClick={nextRound} className="rounded-2xl bg-slate-900 px-8 py-4 font-bold text-white shadow-lg">Next Word</button>
        </div>
      )}
      {message.includes('❌') && <p className="mt-4 text-rose-500 font-bold">{message}</p>}
    </div>
  )
}
