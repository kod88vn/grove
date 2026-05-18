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
  const [lastLoser, setLastLoser] = useState(null)
  const [message, setMessage] = useState('AI played the first stone at the center. Your turn!')
  const [winner, setWinner] = useState(null)
  const [aiThinking, setAiThinking] = useState(false)
  const [winsForExpertUnlocked, setWinsForExpertUnlocked] = useState(0)
  const [manualDifficultyOverride, setManualDifficultyOverride] = useState(null)
  const [score, setScore] = useState({ human: 0, ai: 0 })
  const scoreRef = useRef({ human: 0, ai: 0 })
  const lastLoserRef = useRef(null)

  // Keep lastLoser ref in sync so reset() always reads current value
  useEffect(() => {
    lastLoserRef.current = lastLoser
  }, [lastLoser])

  // Unlock thresholds: easy=0, medium=1, hard=3, expert=5
  const getUnlockedDifficulty = () => {
    if (winsForExpertUnlocked >= 5) return 'expert'
    if (winsForExpertUnlocked >= 3) return 'hard'
    if (winsForExpertUnlocked >= 1) return 'medium'
    return 'easy'
  }

  const unlockedDifficulty = getUnlockedDifficulty()
  const workerRef = useRef(null)
  const pendingJobIdRef = useRef(0)
  const pendingBoardRef = useRef(null)
  const roundIdRef = useRef(0)

  // Keep score ref in sync so worker onmessage always reads current value
  useEffect(() => {
    scoreRef.current = score
  }, [score])


  const handleSymbolSelect = (selectedEmoji) => {
    setHumanSymbol(selectedEmoji)
    const aiSym = getRandomAiSymbol(selectedEmoji)
    setAiSymbol(aiSym.emoji)
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
    if (typeof Worker === 'undefined') {
      return undefined
    }

    const worker = createWorker(window.location.pathname)

    if (!worker) {
      setMessage('AI worker could not be initialized. Game may not function.')
      return undefined
    }

    workerRef.current = worker

    // Add error handler to surface worker loading failures in production
    worker.onerror = () => {
      setAiThinking(false)
      setMessage('AI worker failed to load. Using fallback mode.')
    }

    worker.onmessage = (event) => {
      const payload = event.data || {}

      // Double-check: round ID must match AND job ID must match
      if (payload.roundId !== roundIdRef.current || payload.jobId !== pendingJobIdRef.current) {
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
    }

    return () => {
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
    // Block if round is over or AI is thinking — this IS the move lock.
    // No separate lock state needed: aiThinking already prevents human from moving while AI computes.
    if (winner || aiThinking) {
      return
    }

    // Use the actual stones state to compute the move — never use a stale ref
    const legal = isGomokuMoveLegal(stones, x, y)

    if (!legal) {
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

      // Track wins for progressive difficulty unlock
      setWinsForExpertUnlocked((w) => w + 1)

      if (nextScore === 5 && score.ai === 5) {
        setMessage('⚽ Penalty Shootout Draw! Both reached 5. Unbelievable!')
      } else if (nextScore === 5) {
        setMessage('🏆 YOU WIN THE TOURNAMENT! (5 points)')
      } else {
        const newWins = winsForExpertUnlocked + 1
        let unlockMsg = ''
        if (newWins === 1) {
          unlockMsg = '🎓 Medium level unlocked!'
        } else if (newWins === 3) {
          unlockMsg = '🎓 Hard level unlocked!'
        } else if (newWins === 5) {
          unlockMsg = '🎓 Expert level unlocked!'
        }
        if (unlockMsg) {
          setMessage(`🏆 You made five! Loser (AI) starts the next round.\n${unlockMsg}`)
        } else {
          setMessage('🏆 You made five! Loser (AI) starts the next round.')
        }
      }
      return
    }

    // AI's turn - trigger worker or fallback
    setAiThinking(true)
    setMessage('🤖 AI is thinking hard...')

    const jobId = pendingJobIdRef.current + 1
    pendingJobIdRef.current = jobId
    pendingBoardRef.current = afterHuman

    // Select difficulty level: use manual override if set, otherwise auto-unlock based on wins
    const currentDifficulty = manualDifficultyOverride || unlockedDifficulty
    const aiConfig = GOMOKU_AI_CONFIGS[currentDifficulty]

    if (workerRef.current) {
      try {
        workerRef.current.postMessage({
          jobId,
          roundId: roundIdRef.current,
          stones: afterHuman,
          config: aiConfig,
          difficulty: currentDifficulty,
        })
      } catch (postError) {
        // Fall through to fallback
      }
      return
    }

    // Fallback path - worker not available
    // Capture the round ID at call time so stale timeouts can be invalidated
    const fallbackRoundId = roundIdRef.current

      setTimeout(() => {
      // Double-check: round ID and job ID must match
      if (jobId !== pendingJobIdRef.current || fallbackRoundId !== roundIdRef.current) {
        return
      }

      const currentDifficulty = manualDifficultyOverride || unlockedDifficulty
      const aiConfig = GOMOKU_AI_CONFIGS[currentDifficulty]

      // Legacy name mapping for backward compatibility
      const _LEGACY_MAP = { beginner: 'easy', intermediate: 'medium', master: 'expert' }
      const resolvedDifficulty = _LEGACY_MAP[currentDifficulty] || currentDifficulty

      let aiMove
      if (resolvedDifficulty === 'expert') {
        aiMove = chooseGomokuAIMoveExpert(afterHuman, aiConfig)
      } else {
        aiMove = chooseGomokuAIMove(afterHuman, aiConfig)
      }

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
    // Bump round ID and job ID to invalidate ALL pending worker responses from previous rounds
    roundIdRef.current += 1
    pendingJobIdRef.current += 1
    pendingBoardRef.current = null

    // Use ref to always read the freshest lastLoser value, avoiding stale closure bug
    // where reset() would see an outdated lastLoser from a previous render.
    const currentLastLoser = lastLoserRef.current

    if (currentLastLoser === 'human') {
      // Human lost, so human goes first. Board starts empty.
      setStones({})
      setLastHumanMove(null)
      setLastAiMove(null)
      setAiThinking(false)
      setMessage('You lost, so you go first! Place your stone anywhere.')
    } else {
      // AI lost or first round: AI starts at center.
      setStones({ [coordKey(0, 0)]: 'ai' })
      setLastHumanMove(null)
      setLastAiMove({ x: 0, y: 0 })
      setAiThinking(false)
      setMessage(
        currentLastLoser === 'ai' ? 'AI lost, so it starts center. Your turn!' : 'AI starts the first round. Your turn!'
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
    const difficultyOptions = [
      { key: 'easy', emoji: '🌱', label: 'Easy (Depth 2)', styles: { border: 'border-green-300', bg: 'bg-green-50', hoverBorder: 'hover:border-green-400', hoverBg: 'hover:bg-green-100', text: 'text-green-900' } },
      { key: 'medium', emoji: '⚡', label: 'Medium (Depth 3)', styles: { border: 'border-blue-300', bg: 'bg-blue-50', hoverBorder: 'hover:border-blue-400', hoverBg: 'hover:bg-blue-100', text: 'text-blue-900' } },
      { key: 'hard', emoji: '🔥', label: 'Hard (Depth 4)', styles: { border: 'border-orange-300', bg: 'bg-orange-50', hoverBorder: 'hover:border-orange-400', hoverBg: 'hover:bg-orange-100', text: 'text-orange-900' } },
      { key: 'expert', emoji: '👑', label: 'Expert (Depth 5)', styles: { border: 'border-purple-300', bg: 'bg-purple-50', hoverBorder: 'hover:border-purple-400', hoverBg: 'hover:bg-purple-100', text: 'text-purple-900' } },
    ]

    return (
      <section>
        <div className="rounded-2xl border-2 border-lime-300 bg-lime-50 p-8">
          <h2 className="mb-6 text-center text-2xl font-bold text-lime-900">Choose AI Difficulty</h2>
          <p className="mb-6 text-center text-sm text-lime-700">Select the AI difficulty level for testing. See README.md for full details.</p>
          
          <div className="flex flex-col gap-4">
            {difficultyOptions.map(({ key, emoji, label, styles }) => (
              <button
                key={key}
                onClick={() => handleDifficultySelect(key)}
                className={`rounded-lg border-2 ${styles.border} ${styles.bg} transition ${styles.hoverBorder} ${styles.hoverBg} active:scale-95 p-6 text-center`}
              >
                <div className="text-3xl mb-2">{emoji}</div>
                <h3 className={`text-lg font-bold ${styles.text}`}>{label}</h3>
              </button>
            ))}
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
                disabled={occupied || aiThinking || winner}
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
          You are {humanSymbol} and AI is {aiSymbol}. AI Level: <span className="font-bold">{
            manualDifficultyOverride
              ? { easy: '🌱 Easy (2)', medium: '⚡ Medium (3)', hard: '🔥 Hard (4)', expert: '👑 Expert (5)' }[manualDifficultyOverride]
              : { easy: '🌱 Easy (2)', medium: '⚡ Medium (3)', hard: '🔥 Hard (4)', expert: '👑 Expert (5)' }[unlockedDifficulty]
          }</span>
          {manualDifficultyOverride && <span className="ml-2 text-orange-600">(🧪 Dev Override)</span>}
        </p>

      {process.env.NODE_ENV === 'development' && (
        <div className="mt-4 flex flex-wrap gap-2 rounded-lg border-2 border-orange-300 bg-orange-50 p-3">
          <span className="text-xs font-semibold text-orange-700 w-full mb-1">🧪 Dev Mode:</span>
          {['easy', 'medium', 'hard', 'expert'].map((level) => (
            <button
              key={level}
              onClick={() => setManualDifficultyOverride(level)}
              className={`rounded px-2 py-1 text-xs font-semibold transition ${
                manualDifficultyOverride === level
                  ? 'bg-orange-500 text-white'
                  : 'bg-white text-orange-600 border border-orange-300 hover:bg-orange-50'
              }`}
            >
              {{ easy: '🌱', medium: '⚡', hard: '🔥', expert: '👑' }[level]} {level.charAt(0).toUpperCase() + level.slice(1)}
            </button>
          ))}
          <button
            onClick={() => setManualDifficultyOverride(null)}
            className={`rounded px-2 py-1 text-xs font-semibold transition ${
              manualDifficultyOverride === null
                ? 'bg-slate-500 text-white'
                : 'bg-white text-slate-600 border border-slate-300 hover:bg-slate-50'
            }`}
          >
            ⚙️ Auto ({unlockedDifficulty})
          </button>
        </div>
      )}
    </section>
  )
}