'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  chooseGomokuAIMove,
  chooseGomokuAIMoveExpert,
  coordKey,
  getGomokuWinner,
  isGomokuMoveLegal,
  GOMOKU_DIFFICULTY_LEVELS,
  GOMOKU_AI_CONFIGS,
} from '../index.js'
import { createWorker } from '../gomokuWorker.js'

const AVAILABLE_SYMBOLS = [
  { emoji: '🦊', name: 'Fox' },
  { emoji: '🐼', name: 'Panda' },
  { emoji: '🐰', name: 'Bunny' },
  { emoji: '🦁', name: 'Lion' },
  { emoji: '🐯', name: 'Tiger' },
  { emoji: '🐻', name: 'Bear' },
  { emoji: '🐺', name: 'Wolf' },
  { emoji: '🦅', name: 'Eagle' },
  { emoji: '🐢', name: 'Turtle' },
  { emoji: '🦗', name: 'Cricket' },
]

function getRandomAiSymbol(humanEmoji) {
  const available = AVAILABLE_SYMBOLS.filter((s) => s.emoji !== humanEmoji)
  return available[Math.floor(Math.random() * available.length)]
}

export default function GomokuGame() {
  const [symbolSelectionMode, setSymbolSelectionMode] = useState(true)
  const [humanSymbol, setHumanSymbol] = useState(null)
  const [aiSymbol, setAiSymbol] = useState(null)
  const [difficultySelectionMode, setDifficultySelectionMode] = useState(false)
  const [stones, setStones] = useState({ [coordKey(0, 0)]: 'ai' })
  const [lastHumanMove, setLastHumanMove] = useState(null)
  const [lastAiMove, setLastAiMove] = useState({ x: 0, y: 0 })
  const [score, setScore] = useState({ human: 0, ai: 0 })
  const scoreRef = useRef({ human: 0, ai: 0 })
  const [lastLoser, setLastLoser] = useState(null)
  const [message, setMessage] = useState('AI played the first stone at the center. Your turn!')
  const [winner, setWinner] = useState(null)
  const [aiThinking, setAiThinking] = useState(false)
  const [aiDifficulty, setAiDifficulty] = useState('intermediate')
  const [expertUnlocked, setExpertUnlocked] = useState(false)
  const [manualDifficultyOverride, setManualDifficultyOverride] = useState(null)
  const workerRef = useRef(null)
  const pendingJobIdRef = useRef(0)
  const pendingBoardRef = useRef(null)

  // Keep score ref in sync so worker onmessage always reads current value
  useEffect(() => {
    scoreRef.current = score
  }, [score])

  const handleSymbolSelect = (selectedEmoji) => {
    console.log('[Gomoku] Symbol selected:', selectedEmoji)
    setHumanSymbol(selectedEmoji)
    const aiSym = getRandomAiSymbol(selectedEmoji)
    setAiSymbol(aiSym.emoji)
    console.log('[Gomoku] AI symbol chosen:', aiSym.emoji)
    setSymbolSelectionMode(false)
    // Show difficulty selection in dev mode
    if (process.env.NODE_ENV === 'development') {
      setDifficultySelectionMode(true)
    } else {
      setMessage('AI played the first stone at the center. Your turn!')
    }
  }

  const handleDifficultySelect = (difficulty) => {
    setManualDifficultyOverride(difficulty)
    setDifficultySelectionMode(false)
    setMessage('AI played the first stone at the center. Your turn!')
  }

  useEffect(() => {
    console.log('[Gomoku] === Worker setup effect running ===')
    console.log('[Gomoku] window.location.pathname:', typeof window !== 'undefined' ? window.location.pathname : 'N/A (SSR)')
    console.log('[Gomoku] typeof Worker:', typeof Worker)

    if (typeof Worker === 'undefined') {
      console.warn('[Gomoku] Worker API not available in this environment (Node.js/ssr)')
      return undefined
    }

    const worker = createWorker(window.location.pathname)
    console.log('[Gomoku] Worker created:', !!worker, 'type:', worker?.constructor?.name)
    console.log('[Gomoku] Worker state after create:', worker?.readyState)

    if (!worker) {
      console.error('[Gomoku] FATAL: createWorker returned null/undefined!')
      setMessage('AI worker could not be initialized. Game may not function.')
      return undefined
    }

    workerRef.current = worker

    // Add error handler to surface worker loading failures in production
    worker.onerror = (error) => {
      console.error('[Gomoku] ═══════════════════════════════════════')
      console.error('[Gomoku] !!! WORKER ERROR EVENT CAPTURED !!!')
      console.error('[Gomoku] ═══════════════════════════════════════')
      console.error('[Gomoku] error.type:', error.type)
      console.error('[Gomoku] error.filename:', error.filename)
      console.error('[Gomoku] error.lineno:', error.lineno)
      console.error('[Gomoku] error.colno:', error.colno)
      console.error('[Gomoku] error.message:', error.message)
      console.error('[Gomoku] error.full:', error)
      setAiThinking(false)
      setMessage('AI worker failed to load. Using fallback mode.')
    }

    console.log('[Gomoku] onerror handler attached')

    worker.onmessage = (event) => {
      console.log('[Gomoku] ═══════════════════════════════════════')
      console.log('[Gomoku] !!! WORKER onmessage RECEIVED !!!')
      console.log('[Gomoku] ═══════════════════════════════════════')
      console.log('[Gomoku] event.data exists:', !!event.data)
      console.log('[Gomoku] event.data keys:', event.data ? Object.keys(event.data) : 'N/A')

      const payload = event.data || {}
      console.log('[Gomoku] payload.jobId:', payload.jobId, 'pendingJobIdRef.current:', pendingJobIdRef.current)

      if (payload.jobId !== pendingJobIdRef.current) {
        console.log('[Gomoku] Job ID mismatch - ignoring stale response')
        return
      }

      const baseBoard = pendingBoardRef.current
      console.log('[Gomoku] pendingBoardRef.current:', !!baseBoard, 'keys:', baseBoard ? Object.keys(baseBoard) : 'N/A')
      pendingBoardRef.current = null

      if (!baseBoard || payload.error) {
        console.warn('[Gomoku] Early exit from onmessage:', { hasBaseBoard: !!baseBoard, error: payload.error })
        setAiThinking(false)
        setMessage('AI got confused for a moment. Your turn!')
        return
      }

      if (!payload.move) {
        console.log('[Gomoku] No move in payload')
        setAiThinking(false)
        setMessage('No legal moves left. It is a draw!')
        return
      }

      console.log('[Gomoku] AI move received from worker:', payload.move)
      const afterAI = {
        ...baseBoard,
        [coordKey(payload.move.x, payload.move.y)]: 'ai',
      }
      setStones(afterAI)
      setLastAiMove(payload.move)

      const aiWinner = getGomokuWinner(afterAI, payload.move)
      setAiThinking(false)

      if (aiWinner) {
        const currentScore = scoreRef.current
        const nextScore = currentScore.ai + 1
        setWinner('ai')
        setLastLoser('human')
        setScore((s) => ({ ...s, ai: nextScore }))

        if (nextScore === 5 && currentScore.human === 5) {
          setMessage('⚽ Penalty Shootout Draw! Both reached 5. Unbelievable!')
        } else if (nextScore === 5) {
          setMessage('🏆 AI WINS THE TOURNAMENT! (5 points)')
        } else {
          setMessage('🤖 AI connected five. Loser (You) starts the next round!')
        }
      } else {
        setMessage('Your turn. Remember: max distance is 3 cells from existing stones.')
      }

      console.log('[Gomoku] ═══════════════════════════════════════')
    }

    console.log('[Gomoku] onmessage handler attached')
    console.log('[Gomoku] === Worker setup complete ===')

    return () => {
      console.log('[Gomoku] Worker cleanup: terminating')
      worker.terminate()
      workerRef.current = null
    }
  }, [])

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
    console.log('[Gomoku] ═══════════════════════════════════════')
    console.log('[Gomoku] playHumanMove called:', { x, y })
    console.log('[Gomoku] State at move time:', { winner: !!winner, aiThinking, stonesCount: Object.keys(stones).length })

    if (winner || aiThinking) {
      console.log('[Gomoku] Move blocked: winner or AI thinking')
      return
    }

    const legal = isGomokuMoveLegal(stones, x, y)
    console.log('[Gomoku] Move legality check:', legal)

    if (!legal) {
      console.log('[Gomoku] Move rejected: illegal at', x, y)
      setMessage('Move blocked: place within 3 cells of the nearest stone.')
      return
    }

    const afterHuman = {
      ...stones,
      [coordKey(x, y)]: 'human',
    }

    const humanWinner = getGomokuWinner(afterHuman, { x, y })
    console.log('[Gomoku] Human winner check:', !!humanWinner)
    setStones(afterHuman)
    setLastHumanMove({ x, y })

    if (humanWinner) {
      const nextScore = score.human + 1
      setWinner('human')
      setLastLoser('ai')
      setScore((s) => ({ ...s, human: nextScore }))

      // Unlock expert difficulty when AI loses
      if (!expertUnlocked) {
        setExpertUnlocked(true)
      }

      if (nextScore === 5 && score.ai === 5) {
        setMessage('⚽ Penalty Shootout Draw! Both reached 5. Unbelievable!')
      } else if (nextScore === 5) {
        setMessage('🏆 YOU WIN THE TOURNAMENT! (5 points)')
      } else if (!expertUnlocked) {
        setMessage('🏆 You made five! Loser (AI) starts the next round.\n🎓 Expert level unlocked!')
      } else {
        setMessage('🏆 You made five! Loser (AI) starts the next round.')
      }
      console.log('[Gomoku] Human won this round')
      return
    }

    // AI's turn - trigger worker or fallback
    console.log('[Gomoku] Setting AI thinking state')
    setAiThinking(true)
    setMessage('🤖 AI is thinking hard...')

    const jobId = pendingJobIdRef.current + 1
    pendingJobIdRef.current = jobId
    pendingBoardRef.current = afterHuman

    // Select difficulty level: use manual override if set, otherwise auto-unlock expert after first AI loss
    const currentDifficulty = manualDifficultyOverride || (expertUnlocked ? 'expert' : 'intermediate')
    const aiConfig = GOMOKU_AI_CONFIGS[currentDifficulty]

    console.log('[Gomoku] AI config:', { jobId, difficulty: currentDifficulty, stonesCount: Object.keys(afterHuman).length })
    console.log('[Gomoku] workerRef.current exists:', !!workerRef.current)

    if (workerRef.current) {
      console.log('[Gomoku] Posting message to worker...')
      try {
        workerRef.current.postMessage({
          jobId,
          stones: afterHuman,
          config: aiConfig,
          difficulty: currentDifficulty,
        })
        console.log('[Gomoku] Message posted to worker successfully')
      } catch (postError) {
        console.error('[Gomoku] FAILED to post message to worker:', postError)
        console.error('[Gomoku] Worker state:', { readyState: workerRef.current.readyState, exists: !!workerRef.current })
        // Fall through to fallback
      }
      console.log('[Gomoku] ═══════════════════════════════════════')
      return
    }

    // Fallback path - worker not available
    console.log('[Gomoku] No worker available, using fallback setTimeout path')
    setTimeout(() => {
      console.log('[Gomoku] Fallback setTimeout fired, job check:', { jobId, currentJobId: pendingJobIdRef.current })
      if (jobId !== pendingJobIdRef.current) {
        console.log('[Gomoku] Fallback: stale job, skipping')
        return
      }

      const currentDifficulty = manualDifficultyOverride || (expertUnlocked ? 'expert' : 'intermediate')
      const aiConfig = GOMOKU_AI_CONFIGS[currentDifficulty]

      console.log('[Gomoku] Fallback: calling AI with difficulty:', currentDifficulty)
      let aiMove
      if (currentDifficulty === 'expert') {
        console.log('[Gomoku] Fallback: using expert AI')
        aiMove = chooseGomokuAIMoveExpert(afterHuman, aiConfig)
      } else {
        console.log('[Gomoku] Fallback: using intermediate AI')
        aiMove = chooseGomokuAIMove(afterHuman, aiConfig)
      }

      console.log('[Gomoku] Fallback: AI move result:', aiMove)
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

      console.log('[Gomoku] ═══════════════════════════════════════')
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

  // If in symbol selection mode, show selection UI
  if (symbolSelectionMode) {
    return (
      <section>
        <div className="rounded-2xl border-2 border-lime-300 bg-lime-50 p-8">
          <h2 className="mb-6 text-center text-2xl font-bold text-lime-900">Choose Your Symbol</h2>
          <p className="mb-6 text-center text-sm text-lime-700">Pick an animal symbol to play with. The AI will choose a different one.</p>
          
          <div className="grid grid-cols-5 gap-4">
            {AVAILABLE_SYMBOLS.map((symbol) => (
              <button
                key={symbol.emoji}
                onClick={() => handleSymbolSelect(symbol.emoji)}
                className="flex flex-col items-center gap-2 rounded-lg border-2 border-lime-200 bg-white p-4 transition hover:border-lime-400 hover:bg-lime-100 active:scale-95"
              >
                <span className="text-5xl">{symbol.emoji}</span>
                <span className="text-xs font-semibold text-slate-600">{symbol.name}</span>
              </button>
            ))}
          </div>
        </div>
      </section>
    )
  }

  // Difficulty selection screen (development mode only)
  if (difficultySelectionMode) {
    return (
      <section>
        <div className="rounded-2xl border-2 border-lime-300 bg-lime-50 p-8">
          <h2 className="mb-6 text-center text-2xl font-bold text-lime-900">Choose AI Difficulty</h2>
          <p className="mb-6 text-center text-sm text-lime-700">Select the AI difficulty level for testing.</p>
          
          <div className="flex flex-col gap-4">
            <button
              onClick={() => handleDifficultySelect('intermediate')}
              className="rounded-lg border-2 border-blue-300 bg-blue-50 p-6 text-center transition hover:border-blue-400 hover:bg-blue-100 active:scale-95"
            >
              <div className="text-3xl mb-2">⚡</div>
              <h3 className="text-lg font-bold text-blue-900">Intermediate</h3>
              <p className="text-sm text-blue-700 mt-2">Standard MCTS algorithm. Good for learning and casual play.</p>
            </button>
            
            <button
              onClick={() => handleDifficultySelect('expert')}
              className="rounded-lg border-2 border-red-300 bg-red-50 p-6 text-center transition hover:border-red-400 hover:bg-red-100 active:scale-95"
            >
              <div className="text-3xl mb-2">🏆</div>
              <h3 className="text-lg font-bold text-red-900">Expert</h3>
              <p className="text-sm text-red-700 mt-2">Reward-based AI. Strategic play with strong defense and connection building.</p>
            </button>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section>
      <p className="mb-3 rounded-xl bg-lime-100 px-4 py-3 text-sm font-semibold text-lime-800">
        🪨 Gomoku infinity board: make 5 in a row against AI. Legal moves must be within 3 cells of the nearest stone.
      </p>

      <div className="max-h-[66vh] overflow-auto rounded-2xl border-2 border-lime-300 bg-lime-50 p-3">
        <div className="inline-grid gap-1" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 2.1rem))` }}>
          {cells.map((cell) => {
            const marker = cell.stone === 'human' ? humanSymbol : cell.stone === 'ai' ? aiSymbol : ''
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
          <span className="text-blue-600">{humanSymbol} {score.human}</span>
          <span className="text-slate-300">|</span>
          <span className="text-rose-600">{aiSymbol} {score.ai}</span>
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

      <p className="mt-2 text-xs font-medium text-slate-500">
        You are {humanSymbol} and AI is {aiSymbol}. AI Level: <span className="font-bold">{manualDifficultyOverride || (expertUnlocked ? '🏆 Expert' : '⚡ Intermediate')}</span>
        {manualDifficultyOverride && <span className="ml-2 text-orange-600">(🧪 Dev Override)</span>}
      </p>

      {process.env.NODE_ENV === 'development' && (
        <div className="mt-4 flex gap-2 rounded-lg border-2 border-orange-300 bg-orange-50 p-3">
          <span className="text-xs font-semibold text-orange-700">🧪 Dev Mode:</span>
          <button
            onClick={() => setManualDifficultyOverride('intermediate')}
            className={`rounded px-2 py-1 text-xs font-semibold transition ${
              manualDifficultyOverride === 'intermediate'
                ? 'bg-blue-500 text-white'
                : 'bg-white text-blue-600 border border-blue-300 hover:bg-blue-50'
            }`}
          >
            ⚡ Intermediate
          </button>
          <button
            onClick={() => setManualDifficultyOverride('expert')}
            className={`rounded px-2 py-1 text-xs font-semibold transition ${
              manualDifficultyOverride === 'expert'
                ? 'bg-red-500 text-white'
                : 'bg-white text-red-600 border border-red-300 hover:bg-red-50'
            }`}
          >
            🏆 Expert
          </button>
          <button
            onClick={() => setManualDifficultyOverride(null)}
            className={`rounded px-2 py-1 text-xs font-semibold transition ${
              manualDifficultyOverride === null
                ? 'bg-slate-500 text-white'
                : 'bg-white text-slate-600 border border-slate-300 hover:bg-slate-50'
            }`}
          >
            ⚙️ Auto
          </button>
        </div>
      )}
    </section>
  )
}