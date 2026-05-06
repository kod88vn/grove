'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  chooseGomokuAIMove,
  coordKey,
  getGomokuWinner,
  isGomokuMoveLegal,
} from '@/lib/modules/games'

const GOMOKU_AI_CONFIG = {
  timeBudgetMs: 2200,
  maxPlayouts: 9000,
  maxRolloutDepth: 14,
  candidateLimit: 24,
  rolloutCandidateLimit: 10,
}

export default function GomokuGame() {
  const [stones, setStones] = useState({ [coordKey(0, 0)]: 'ai' })
  const [lastHumanMove, setLastHumanMove] = useState(null)
  const [lastAiMove, setLastAiMove] = useState({ x: 0, y: 0 })
  const [score, setScore] = useState({ human: 0, ai: 0 })
  const [lastLoser, setLastLoser] = useState(null)
  const [message, setMessage] = useState('AI played the first stone at the center. Your turn!')
  const [winner, setWinner] = useState(null)
  const [aiThinking, setAiThinking] = useState(false)
  const workerRef = useRef(null)
  const pendingJobIdRef = useRef(0)
  const pendingBoardRef = useRef(null)

  useEffect(() => {
    if (typeof Worker === 'undefined') {
      return undefined
    }

    const worker = new Worker('/gomoku-ai-worker.js')
    workerRef.current = worker

    worker.onmessage = (event) => {
      const payload = event.data || {}
      if (payload.jobId !== pendingJobIdRef.current) {
        return
      }

      const baseBoard = pendingBoardRef.current
      pendingBoardRef.current = null

      if (!baseBoard || payload.error) {
        setAiThinking(false)
        setMessage('AI got confused for a moment. Your turn!')
        return
      }

      if (!payload.move) {
        setAiThinking(false)
        setMessage('No legal moves left. It is a draw!')
        return
      }

      const afterAI = {
        ...baseBoard,
        [coordKey(payload.move.x, payload.move.y)]: 'ai',
      }
      setStones(afterAI)
      setLastAiMove(payload.move)

      const aiWinner = getGomokuWinner(afterAI, payload.move)
      setAiThinking(false)

      if (aiWinner) {
        const nextScore = score.ai + 1
        setWinner('ai')
        setLastLoser('human')
        setScore((s) => ({ ...s, ai: nextScore }))

        if (nextScore === 5 && score.human === 5) {
          setMessage('⚽ Penalty Shootout Draw! Both reached 5. Unbelievable!')
        } else if (nextScore === 5) {
          setMessage('🏆 AI WINS THE TOURNAMENT! (5 points)')
        } else {
          setMessage('🤖 AI connected five. Loser (You) starts the next round!')
        }
      } else {
        setMessage('Your turn. Remember: max distance is 3 cells from existing stones.')
      }
    }

    return () => {
      worker.terminate()
      workerRef.current = null
    }
  }, [score])

  const points = useMemo(() => Object.keys(stones).map((key) => {
    const [x, y] = key.split(',').map(Number)
    return { x, y, player: stones[key] }
  }), [stones])

  const bounds = useMemo(() => {
    if (!points.length) {
      return { minX: -5, maxX: 5, minY: -5, maxY: 5 }
    }

    let minX = points[0].x
    let maxX = points[0].x
    let minY = points[0].y
    let maxY = points[0].y

    for (const point of points) {
      minX = Math.min(minX, point.x)
      maxX = Math.max(maxX, point.x)
      minY = Math.min(minY, point.y)
      maxY = Math.max(maxY, point.y)
    }

    const width = maxX - minX + 1
    const height = maxY - minY + 1
    const extraX = Math.max(2, Math.ceil((11 - width) / 2))
    const extraY = Math.max(2, Math.ceil((11 - height) / 2))

    return {
      minX: minX - extraX,
      maxX: maxX + extraX,
      minY: minY - extraY,
      maxY: maxY + extraY,
    }
  }, [points])

  const cells = []
  for (let y = bounds.minY; y <= bounds.maxY; y += 1) {
    for (let x = bounds.minX; x <= bounds.maxX; x += 1) {
      cells.push({ x, y, stone: stones[coordKey(x, y)] })
    }
  }

  const playHumanMove = (x, y) => {
    if (winner || aiThinking) {
      return
    }

    if (!isGomokuMoveLegal(stones, x, y)) {
      setMessage('Move blocked: place within 3 cells of the nearest stone.')
      return
    }

    const afterHuman = {
      ...stones,
      [coordKey(x, y)]: 'human',
    }

    const humanWinner = getGomokuWinner(afterHuman, { x, y })
    setStones(afterHuman)
    setLastHumanMove({ x, y })

    if (humanWinner) {
      const nextScore = score.human + 1
      setWinner('human')
      setLastLoser('ai')
      setScore((s) => ({ ...s, human: nextScore }))

      if (nextScore === 5 && score.ai === 5) {
        setMessage('⚽ Penalty Shootout Draw! Both reached 5. Unbelievable!')
      } else if (nextScore === 5) {
        setMessage('🏆 YOU WIN THE TOURNAMENT! (5 points)')
      } else {
        setMessage('🏆 You made five! Loser (AI) starts the next round.')
      }
      return
    }

    setAiThinking(true)
    setMessage('🤖 AI is thinking hard...')

    const jobId = pendingJobIdRef.current + 1
    pendingJobIdRef.current = jobId
    pendingBoardRef.current = afterHuman

    if (workerRef.current) {
      workerRef.current.postMessage({
        jobId,
        stones: afterHuman,
        config: GOMOKU_AI_CONFIG,
      })
      return
    }

    // Fallback path
    setTimeout(() => {
      if (jobId !== pendingJobIdRef.current) {
        return
      }

      const aiMove = chooseGomokuAIMove(afterHuman, GOMOKU_AI_CONFIG)
      if (!aiMove) {
        setAiThinking(false)
        setMessage('No legal moves left. It is a draw!')
        return
      }

      const afterAI = {
        ...afterHuman,
        [coordKey(aiMove.x, aiMove.y)]: 'ai',
      }
      setStones(afterAI)
      setLastAiMove(aiMove)

      const aiWinner = getGomokuWinner(afterAI, aiMove)
      setAiThinking(false)

      if (aiWinner) {
        const nextScore = score.ai + 1
        setWinner('ai')
        setLastLoser('human')
        setScore((s) => ({ ...s, ai: nextScore }))

        if (nextScore === 5 && score.human === 5) {
          setMessage('⚽ Penalty Shootout Draw! Both reached 5. Unbelievable!')
        } else if (nextScore === 5) {
          setMessage('🏆 AI WINS THE TOURNAMENT! (5 points)')
        } else {
          setMessage('🤖 AI connected five. Loser (You) starts the next round!')
        }
      } else {
        setMessage('Your turn. Remember: max distance is 3 cells from existing stones.')
      }
    }, 0)
  }

  const reset = () => {
    pendingJobIdRef.current += 1
    pendingBoardRef.current = null

    if (lastLoser === 'human') {
      setStones({})
      setLastHumanMove(null)
      setLastAiMove(null)
      setAiThinking(false)
      setMessage('You lost, so you go first! Place your stone anywhere.')
    } else {
      setStones({ [coordKey(0, 0)]: 'ai' })
      setLastHumanMove(null)
      setLastAiMove({ x: 0, y: 0 })
      setAiThinking(false)
      setMessage(
        lastLoser === 'ai' ? 'AI lost, so it starts center. Your turn!' : 'AI starts the first round. Your turn!'
      )
    }

    if (score.human >= 5 || score.ai >= 5) {
      setScore({ human: 0, ai: 0 })
      setLastLoser(null)
    }

    setWinner(null)
  }

  const columns = bounds.maxX - bounds.minX + 1

  return (
    <section>
      <p className="mb-3 rounded-xl bg-lime-100 px-4 py-3 text-sm font-semibold text-lime-800">
        🪨 Gomoku infinity board: make 5 in a row against AI. Legal moves must be within 3 cells of the nearest stone.
      </p>

      <div className="max-h-[66vh] overflow-auto rounded-2xl border-2 border-lime-300 bg-lime-50 p-3">
        <div className="inline-grid gap-1" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 2.1rem))` }}>
          {cells.map((cell) => {
            const marker = cell.stone === 'human' ? '🦊' : cell.stone === 'ai' ? '🐼' : ''
            const occupied = Boolean(cell.stone)
            const legal = isGomokuMoveLegal(stones, cell.x, cell.y)
            const isLastMove =
              (lastHumanMove && lastHumanMove.x === cell.x && lastHumanMove.y === cell.y) ||
              (lastAiMove && lastAiMove.x === cell.x && lastAiMove.y === cell.y)

            return (
              <button
                key={coordKey(cell.x, cell.y)}
                type="button"
                disabled={occupied || winner || aiThinking}
                onClick={() => playHumanMove(cell.x, cell.y)}
                className={`flex h-8 w-8 items-center justify-center rounded border text-sm transition ${
                  occupied
                    ? `border-slate-300 bg-white ${isLastMove ? 'ring-2 ring-lime-400 ring-offset-1' : ''}`
                    : legal
                    ? 'border-lime-300 bg-white hover:scale-105 hover:bg-lime-100'
                    : 'border-slate-200 bg-slate-100 text-slate-300 hover:cursor-not-allowed'
                }`}
                title={`(${cell.x}, ${cell.y}) ${isLastMove ? '[Last Move]' : ''}`}
              >
                {marker}
              </button>
            )
          })}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 rounded-full bg-slate-100 px-4 py-1.5 text-sm font-bold shadow-sm">
          <span className="text-slate-500">🏆 Series Score:</span>
          <span className="text-blue-600">🦊 {score.human}</span>
          <span className="text-slate-300">|</span>
          <span className="text-rose-600">🐼 {score.ai}</span>
        </div>
        <p className="flex-1 text-sm font-semibold text-slate-700">{message}</p>
        <button
          type="button"
          onClick={reset}
          className="rounded-full bg-slate-900 px-4 py-2 text-sm font-bold text-white transition hover:bg-slate-700"
        >
          {winner || (score.human === 0 && score.ai === 0) ? 'Next Round' : 'Reset Series'}
        </button>
      </div>

      <p className="mt-2 text-xs font-medium text-slate-500">You are 🦊 and AI is 🐼.</p>
    </section>
  )
}
