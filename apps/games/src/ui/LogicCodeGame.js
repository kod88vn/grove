'use client'

import { useState } from 'react'
import { createBurstParticles, playArcadeEffect } from './arcadeFx'

const COLORS = ['🔴', '🔵', '🟢', '🟡', '🟣', '🟠']
const CODE_LENGTH = 4
const MAX_ATTEMPTS = 8

export default function ShapeLogicGame() {
  const [secret, setSecret] = useState([])
  const [board, setBoard] = useState([]) // { guess, result }
  const [currentGuess, setCurrentGuess] = useState([])
  const [gameState, setGameState] = useState('idle') // idle, playing, won, lost
  const [burst, setBurst] = useState([])

  const celebrate = (effect) => {
    playArcadeEffect(effect)
    setBurst(createBurstParticles(14))
    setTimeout(() => setBurst([]), 520)
  }

  const start = () => {
    const code = []
    for (let i = 0; i < CODE_LENGTH; i++) {
      code.push(COLORS[Math.floor(Math.random() * COLORS.length)])
    }
    setSecret(code)
    setBoard([])
    setCurrentGuess([])
    setGameState('playing')
    playArcadeEffect('start')
  }

  const addColor = (color) => {
    if (currentGuess.length < CODE_LENGTH && gameState === 'playing') {
      setCurrentGuess([...currentGuess, color])
    }
  }

  const removeColor = () => {
    setCurrentGuess(currentGuess.slice(0, -1))
  }

  const submit = () => {
    if (currentGuess.length !== CODE_LENGTH) return

    let perfect = 0
    let close = 0
    
    const secretCopy = [...secret]
    const guessCopy = [...currentGuess]
    
    // Check perfect
    for (let i = 0; i < CODE_LENGTH; i++) {
      if (guessCopy[i] === secretCopy[i]) {
        perfect++
        secretCopy[i] = null
        guessCopy[i] = 'CHECKED'
      }
    }
    
    // Check close
    for (let i = 0; i < CODE_LENGTH; i++) {
      if (guessCopy[i] !== 'CHECKED') {
        const foundIndex = secretCopy.indexOf(guessCopy[i])
        if (foundIndex !== -1) {
          close++
          secretCopy[foundIndex] = null
        }
      }
    }

    const nextBoard = [...board, { guess: currentGuess, perfect, close }]
    setBoard(nextBoard)
    setCurrentGuess([])

    if (perfect === CODE_LENGTH) {
      celebrate('win')
      setGameState('won')
    } else if (nextBoard.length >= MAX_ATTEMPTS) {
      playArcadeEffect('fail')
      setGameState('lost')
    } else {
      if (perfect > 0 || close > 0) {
        celebrate('success')
      } else {
        playArcadeEffect('tap')
      }
    }
  }

  if (gameState === 'idle') {
    return (
      <div className="flex flex-col items-center py-12">
        <h2 className="text-4xl font-black text-rose-600">🕵️‍♀️ Logic Code</h2>
        <p className="mt-4 text-slate-600 font-bold text-center max-w-sm">Crack the secret 4-color code! Use the hints to guess the pattern.</p>
        <div className="mt-6 flex flex-col gap-2 text-sm text-slate-500 font-bold">
          <p>✅ = Right color, Right spot</p>
          <p>⚪ = Right color, Wrong spot</p>
        </div>
        <button onClick={start} className="mt-8 rounded-2xl bg-indigo-500 px-8 py-4 text-xl font-bold text-white shadow-lg hover:bg-indigo-600">
          Start Decoding
        </button>
      </div>
    )
  }

  return (
    <div className="relative flex flex-col items-center rounded-3xl border-2 border-indigo-200 bg-gradient-to-b from-indigo-50 via-white to-rose-50 p-4 shadow-lg">
      {burst.map((particle) => (
        <span
          key={particle.id}
          className="pointer-events-none absolute animate-ping rounded-full bg-indigo-300/80"
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
      <div className="w-full max-w-sm overflow-auto mb-8 h-80 border-b border-slate-100 flex flex-col-reverse">
        {board.map((round, i) => (
          <div key={i} className="flex items-center gap-4 py-3 border-t border-slate-50">
            <span className="text-xs font-bold text-slate-300 w-4">{i + 1}</span>
            <div className="flex gap-2">
              {round.guess.map((c, j) => <span key={j} className="text-2xl">{c}</span>)}
            </div>
            <div className="flex-1 flex justify-end gap-1">
              {[...Array(round.perfect)].map((_, j) => <span key={j}>✅</span>)}
              {[...Array(round.close)].map((_, j) => <span key={j}>⚪</span>)}
            </div>
          </div>
        ))}
      </div>

      {gameState === 'playing' ? (
        <div className="w-full max-w-sm">
          <div className="flex justify-center gap-4 mb-8 h-12 items-center bg-slate-50 rounded-2xl p-2">
            {currentGuess.map((c, i) => (
              <button key={i} onClick={removeColor} className="text-3xl hover:scale-110 active:scale-90 transition">{c}</button>
            ))}
            {[...Array(CODE_LENGTH - currentGuess.length)].map((_, i) => (
              <div key={i} className="w-8 h-8 rounded-full border-2 border-dashed border-slate-200" />
            ))}
          </div>

          <div className="grid grid-cols-3 gap-4 mb-8">
            {COLORS.map((c, i) => (
              <button 
                key={i} 
                onClick={() => addColor(c)}
                className="bg-white border-2 border-slate-100 rounded-2xl p-4 text-3xl hover:bg-slate-50 transition active:scale-95"
              >
                {c}
              </button>
            ))}
          </div>

          <button 
            disabled={currentGuess.length !== CODE_LENGTH}
            onClick={submit}
            className={`w-full py-4 rounded-2xl font-black text-xl text-white shadow-lg transition ${currentGuess.length === CODE_LENGTH ? 'bg-indigo-600' : 'bg-slate-300 cursor-not-allowed'}`}
          >
            Submit Guess
          </button>
        </div>
      ) : (
        <div className="text-center">
          <h3 className={`text-3xl font-black mb-4 ${gameState === 'won' ? 'text-emerald-600' : 'text-rose-500'}`}>
            {gameState === 'won' ? '🎉 Code Cracked!' : '💀 Mission Failed'}
          </h3>
          <p className="font-bold text-slate-500 mb-6">The secret was: {secret.join(' ')}</p>
          <button onClick={start} className="rounded-2xl bg-slate-900 px-8 py-4 font-bold text-white shadow-lg">Try Again</button>
        </div>
      )}
    </div>
  )
}
