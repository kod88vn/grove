'use client'

import { useState, useEffect, useCallback } from 'react'
import { createBurstParticles, playArcadeEffect } from './arcadeFx'

const EMOJIS = ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼']

export default function MemoryGame() {
  const [cards, setCards] = useState([])
  const [flipped, setFlipped] = useState([])
  const [solved, setSolved] = useState([])
  const [moves, setMoves] = useState(0)
  const [gameState, setGameState] = useState('menu')
  const [burst, setBurst] = useState([])

  const celebrate = useCallback((effect) => {
    playArcadeEffect(effect)
    setBurst(createBurstParticles(12))
    setTimeout(() => setBurst([]), 520)
  }, [])

  const initializeGame = () => {
    const deck = [...EMOJIS, ...EMOJIS]
      .sort(() => Math.random() - 0.5)
      .map((symbol, index) => ({ id: index, symbol }))
    setCards(deck)
    setSolved([])
    setFlipped([])
    setMoves(0)
    setGameState('playing')
    playArcadeEffect('start')
  }

  const handleFlip = useCallback((index) => {
    if (flipped.length === 2 || flipped.includes(index) || solved.includes(cards[index].symbol)) return
    
    const newFlipped = [...flipped, index]
    setFlipped(newFlipped)

    if (newFlipped.length === 2) {
      setMoves(m => m + 1)
      const [first, second] = newFlipped
      if (cards[first].symbol === cards[second].symbol) {
        setSolved(s => [...s, cards[first].symbol])
        setFlipped([])
        celebrate('success')
      } else {
        playArcadeEffect('fail')
        setTimeout(() => setFlipped([]), 1000)
      }
    }
  }, [flipped, cards, solved, celebrate])

  useEffect(() => {
    if (solved.length === EMOJIS.length && gameState === 'playing') {
      celebrate('win')
      setGameState('won')
    }
  }, [solved, gameState, celebrate])

  if (gameState === 'menu') {
    return (
      <div className="flex flex-col items-center py-12">
        <h2 className="text-4xl font-black text-indigo-600 mb-4">Memory Match</h2>
        <p className="text-slate-500 font-bold mb-8 text-center max-w-sm">
          Find all matching pairs of funny animal emojis!
        </p>
        <button
          onClick={initializeGame}
          className="rounded-2xl bg-indigo-500 px-8 py-4 text-xl font-bold text-white shadow-lg hover:bg-indigo-600 transition active:scale-95"
        >
          Start Match
        </button>
      </div>
    )
  }

  if (gameState === 'won') {
    return (
      <div className="flex flex-col items-center py-12">
        <h2 className="text-5xl font-black text-emerald-500 mb-4">You Won!</h2>
        <p className="text-2xl font-bold text-slate-700 mb-8">Pairs found in {moves} moves</p>
        <button
          onClick={() => setGameState('menu')}
          className="rounded-2xl bg-slate-900 px-8 py-4 text-xl font-bold text-white"
        >
          Play Again
        </button>
      </div>
    )
  }

  return (
    <div className="relative flex flex-col items-center rounded-3xl border-2 border-indigo-200 bg-gradient-to-b from-indigo-50 via-white to-sky-50 p-4 shadow-lg">
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
      <div className="flex justify-between w-full max-w-md mb-8">
        <div className="text-xl font-black text-slate-400">Moves: {moves}</div>
        <div className="text-xl font-black text-indigo-500">Matches: {solved.length} / {EMOJIS.length}</div>
      </div>

      <div className="grid grid-cols-4 gap-4 max-w-md w-full">
        {cards.map((card, index) => {
          const isFlipped = flipped.includes(index)
          const isSolved = solved.includes(card.symbol)
          return (
            <button
              key={card.id}
              onClick={() => handleFlip(index)}
              className={`aspect-square text-4xl flex items-center justify-center rounded-2xl transition-all duration-300 transform ${
                isFlipped || isSolved 
                  ? 'bg-white rotate-0' 
                  : 'bg-indigo-100 rotate-180 hover:bg-indigo-200'
              } shadow-sm border-b-4 border-slate-200`}
            >
              {(isFlipped || isSolved) ? card.symbol : '❓'}
            </button>
          )
        })}
      </div>
    </div>
  )
}
