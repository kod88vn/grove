'use client'

import { useState, useEffect, useCallback } from 'react'
import { createBurstParticles, playArcadeEffect } from '@/components/games/arcadeFx'

const LEVELS = [
  { name: 'Rookie', range: 10, time: 10 },
  { name: 'Pro', range: 12, time: 7 },
  { name: 'Expert', range: 15, time: 5 },
  { name: 'Lightning', range: 20, time: 3 }
]

export default function MathQuizGame() {
  const [gameState, setGameState] = useState('menu')
  const [level, setLevel] = useState(0)
  const [question, setQuestion] = useState({ a: 0, b: 0, answer: 0 })
  const [userInput, setUserInput] = useState('')
  const [score, setScore] = useState(0)
  const [timeLeft, setTimeLeft] = useState(10)
  const [round, setRound] = useState(0)
  const [history, setHistory] = useState([])
  const [burst, setBurst] = useState([])

  const celebrate = useCallback((effect) => {
    playArcadeEffect(effect)
    setBurst(createBurstParticles(14))
    setTimeout(() => setBurst([]), 520)
  }, [])

  const generateQuestion = useCallback(() => {
    const config = LEVELS[level]
    const a = Math.floor(Math.random() * config.range) + 1
    const b = Math.floor(Math.random() * config.range) + 1
    const answer = a * b
    setQuestion({ a, b, answer })
    setTimeLeft(config.time)
    setUserInput('')
  }, [level])

  const startLevel = (idx) => {
    setLevel(idx)
    setScore(0)
    setRound(1)
    setHistory([])
    setGameState('playing')
    playArcadeEffect('start')
  }

  const handleAnswer = useCallback((isTimeout = false) => {
    const isCorrect = !isTimeout && parseInt(userInput) === question.answer
    const points = isCorrect ? Math.ceil(parseFloat(timeLeft) * 10) : 0
    
    const outcome = {
      q: question.a + " x " + question.b,
      correct: question.answer,
      user: isTimeout ? 'timeout' : userInput,
      status: isCorrect ? 'correct' : 'wrong',
      points
    }

    setHistory((prev) => [outcome, ...prev])
    if (isCorrect) {
      setScore((prev) => prev + points)
      celebrate('success')
    } else {
      playArcadeEffect('fail')
    }

    if (round >= 10) {
      if (isCorrect) {
        celebrate('win')
      }
      setGameState('finished')
    } else {
      setRound((prev) => prev + 1)
      generateQuestion()
    }
  }, [userInput, question, timeLeft, round, generateQuestion, celebrate])

  useEffect(() => {
    if (gameState === 'playing') {
      generateQuestion()
    }
  }, [gameState, generateQuestion])

  useEffect(() => {
    if (gameState !== 'playing' || parseFloat(timeLeft) <= 0) {
      if (parseFloat(timeLeft) <= 0 && gameState === 'playing') {
        handleAnswer(true)
      }
      return
    }

    const timer = setInterval(() => {
      setTimeLeft((prev) => (parseFloat(prev) - 0.1).toFixed(1))
    }, 100)

    return () => clearInterval(timer)
  }, [timeLeft, gameState, handleAnswer])

  if (gameState === 'menu') {
    return (
      <div className="flex flex-col items-center py-8">
        <h2 className="text-4xl font-black text-indigo-600 mb-2">Math Lightning</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-lg mt-8">
          {LEVELS.map((l, i) => (
            <button
              key={i}
              onClick={() => startLevel(i)}
              className="rounded-2xl bg-white border-2 border-slate-100 p-6 text-left transition hover:border-indigo-500"
            >
              <span className="text-xl font-black text-slate-800">{l.name}</span>
            </button>
          ))}
        </div>
      </div>
    )
  }

  if (gameState === 'finished') {
    return (
      <div className="text-center py-8">
        <h2 className="text-4xl font-black">Game Over</h2>
        <p className="text-xl mt-4">Score: {score}</p>
        <button onClick={() => setGameState('menu')} className="mt-8 px-8 py-4 bg-slate-900 text-white rounded-xl">Try Again</button>
      </div>
    )
  }

  return (
    <div className="relative mx-auto flex max-w-md flex-col items-center rounded-3xl border-2 border-indigo-200 bg-gradient-to-b from-indigo-50 via-white to-cyan-50 p-5 shadow-lg">
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
      <div className="mb-4 rounded-full bg-indigo-100 px-3 py-1 text-slate-500 text-sm font-bold uppercase">Round {round} / 10</div>
      <div className="mb-12 text-6xl font-black text-indigo-700">{question.a} x {question.b}</div>
      <form onSubmit={(e) => { e.preventDefault(); handleAnswer(); }} className="w-full">
        <input
          autoFocus
          type="number"
          value={userInput}
          onChange={(e) => setUserInput(e.target.value)}
          className="w-full text-center text-5xl font-black p-8 bg-slate-50 border-4 border-slate-100 rounded-3xl outline-none focus:border-indigo-500 transition-all"
          placeholder="?"
        />
      </form>
      <div className="mt-4 text-sm font-bold text-slate-500">Score: {score}</div>
      <div className="mt-3 text-2xl font-black text-indigo-500">Time Left: {timeLeft}s</div>
    </div>
  )
}
