'use client'

import { useState, useEffect, useCallback } from 'react'
import { createBurstParticles, playArcadeEffect } from './arcadeFx'
import {
  MATH_LIGHTNING_LEVELS,
  adjustMathLightningLevel,
  generateMathLightningQuestion,
  scoreMathLightningAnswer,
} from '../mathLightning.js'

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

  const applyQuestion = useCallback((levelIndex) => {
    const config = MATH_LIGHTNING_LEVELS[levelIndex]
    const next = generateMathLightningQuestion(levelIndex)
    setQuestion(next)
    setTimeLeft(config.time)
    setUserInput('')
  }, [])

  const startGame = () => {
    setLevel(0)
    setScore(0)
    setRound(1)
    setHistory([])
    setGameState('playing')
    playArcadeEffect('start')
    applyQuestion(0)
  }

  const handleAnswer = useCallback((isTimeout = false) => {
    const { isCorrect, points } = scoreMathLightningAnswer({
      userInput,
      answer: question.answer,
      timeLeft,
      levelIndex: level,
      isTimeout,
    })
    
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
      const nextLevel = adjustMathLightningLevel(level, isCorrect)
      setLevel(nextLevel)
      setRound((prev) => prev + 1)
      applyQuestion(nextLevel)
    }
  }, [userInput, question, timeLeft, level, round, applyQuestion, celebrate])

  useEffect(() => {
    if (gameState !== 'playing') {
      return
    }

    if (timeLeft <= 0) {
      handleAnswer(true)
      return
    }

    const timer = setTimeout(() => {
      setTimeLeft((previous) => Math.max(0, Number((previous - 0.1).toFixed(1))))
    }, 100)

    return () => clearTimeout(timer)
  }, [timeLeft, gameState, handleAnswer])

  if (gameState === 'menu') {
    return (
      <div className="flex flex-col items-center py-8">
        <h2 className="text-4xl font-black text-indigo-600 mb-2">Math Lightning</h2>
        <p className="mt-3 max-w-md text-center text-sm font-semibold text-slate-600">
          Start at Rookie. Beat the timer to level up for bigger rewards and tighter time limits. Miss a round and you drop a level.
        </p>
        <button
          onClick={startGame}
          className="mt-8 rounded-2xl bg-indigo-600 px-8 py-4 text-xl font-bold text-white shadow-lg transition hover:bg-indigo-700 active:scale-95"
        >
          Start Run
        </button>
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
      <div className="mb-2 rounded-full bg-cyan-100 px-3 py-1 text-cyan-700 text-xs font-black uppercase">
        Level: {MATH_LIGHTNING_LEVELS[level].name} · x{MATH_LIGHTNING_LEVELS[level].rewardMultiplier}
      </div>
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
      <div className="mt-3 text-2xl font-black text-indigo-500">Time Left: {timeLeft.toFixed(1)}s</div>
    </div>
  )
}
