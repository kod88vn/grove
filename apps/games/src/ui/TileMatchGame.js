'use client'

import { useState, useCallback, useEffect } from 'react'
import { createBurstParticles, playArcadeEffect } from './arcadeFx'

const SYMBOLS = ['🌟', '🎨', '🎭', '🎪', '🎯', '🎲', '🎸', '🎮', '🏆', '🎁']
const GRID_SIZES = {
  easy: { rows: 4, cols: 10 },
  medium: { rows: 6, cols: 10 },
  hard: { rows: 8, cols: 10 },
  expert: { rows: 10, cols: 10 },
}

function createGrid(rows, cols) {
  const tiles = []
  const pairsPerSymbol = Math.ceil((rows * cols) / (SYMBOLS.length * 2))
  for (let s = 0; s < SYMBOLS.length; s++) {
    for (let p = 0; p < pairsPerSymbol && tiles.length < rows * cols; p++) {
      tiles.push(SYMBOLS[s])
      tiles.push(SYMBOLS[s]) // Push twice per pair to make matching pairs
    }
  }
  // Fisher-Yates shuffle with multiple iterations for better randomization
  for (let iter = 0; iter < 3; iter++) {
    for (let i = tiles.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [tiles[i], tiles[j]] = [tiles[j], tiles[i]]
    }
  }
  return tiles
}

function getIndex(row, col, cols) {
  return row * cols + col
}

function canConnect(grid, cols, idx1, idx2, removed) {
  if (grid[idx1] !== grid[idx2] || removed.has(idx1) || removed.has(idx2)) return false

  const [r1, c1] = [Math.floor(idx1 / cols), idx1 % cols]
  const [r2, c2] = [Math.floor(idx2 / cols), idx2 % cols]
  const rows = Math.ceil(grid.length / cols)

  // BFS to find if there's a path through removed cells with max 2 turns
  const queue = [[r1, c1, 0, -1]] // [row, col, turns, lastDirection]
  const visited = new Set()
  visited.add(`${r1},${c1}`)

  const directions = [
    [0, 1, 0], // right
    [0, -1, 1], // left
    [1, 0, 2], // down
    [-1, 0, 3], // up
  ]

  while (queue.length > 0) {
    const [r, c, turns, lastDir] = queue.shift()

    for (const [dr, dc, dirIdx] of directions) {
      const nr = r + dr
      const nc = c + dc

      // Bounds check
      if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue

      // Is this the target?
      if (nr === r2 && nc === c2) {
        return true
      }

      const nidx = getIndex(nr, nc, cols)
      const key = `${nr},${nc}`

      // Only move through empty cells (removed tiles)
      if (removed.has(nidx) && !visited.has(key)) {
        visited.add(key)

        // Count turns: if direction changed and it's not the first move
        let newTurns = turns
        if (lastDir !== -1 && lastDir !== dirIdx) {
          newTurns = turns + 1
        }

        // Only allow up to 2 turns (so max 3 line segments)
        if (newTurns <= 2) {
          queue.push([nr, nc, newTurns, dirIdx])
        }
      }
    }
  }

  return false
}

export default function TileMatchGame() {
  const [level, setLevel] = useState('easy')
  const [grid, setGrid] = useState([])
  const [removed, setRemoved] = useState(new Set())
  const [selected, setSelected] = useState([])
  const [gameState, setGameState] = useState('menu') // menu, playing, won
  const [burst, setBurst] = useState([])
  const [tileSize, setTileSize] = useState(1.75) // in rem

  const celebrate = (effect) => {
    playArcadeEffect(effect)
    setBurst(createBurstParticles(14))
    setTimeout(() => setBurst([]), 520)
  }

  useEffect(() => {
    const updateTileSize = () => {
      const width = window.innerWidth
      const padding = 48 // 24px padding on container sides
      const cols = 10
      const availableWidthPx = width - padding
      const tileSizeRem = availableWidthPx / (cols * 16) // 16px per rem
      const capped = Math.max(1.5, Math.min(6, tileSizeRem))
      setTileSize(parseFloat(capped.toFixed(2)))
    }
    updateTileSize()
    window.addEventListener('resize', updateTileSize)
    return () => window.removeEventListener('resize', updateTileSize)
  }, [])

  const startGame = useCallback((selectedLevel) => {
    const { rows, cols } = GRID_SIZES[selectedLevel]
    const newGrid = createGrid(rows, cols)
    setLevel(selectedLevel)
    setGrid(newGrid)
    setRemoved(new Set())
    setSelected([])
    setGameState('playing')
    playArcadeEffect('start')
  }, [])

  const toggleTile = useCallback(
    (idx) => {
      if (gameState !== 'playing' || removed.has(idx)) return

      const newSelected = selected.includes(idx)
        ? selected.filter((i) => i !== idx)
        : [...selected, idx]

      setSelected(newSelected)

      if (newSelected.length === 2) {
        const [idx1, idx2] = newSelected
        if (canConnect(grid, GRID_SIZES[level].cols, idx1, idx2, removed)) {
          const newRemoved = new Set(removed)
          newRemoved.add(idx1)
          newRemoved.add(idx2)
          setRemoved(newRemoved)
          celebrate('win')
          setSelected([])

          if (newRemoved.size === grid.length) {
            setGameState('won')
            celebrate('win')
          }
        } else {
          playArcadeEffect('lose')
          setSelected([])
        }
      }
    },
    [selected, gameState, grid, level, removed, celebrate]
  )

  const cols = GRID_SIZES[level].cols
  const rows = Math.ceil(grid.length / cols)

  return (
    <section>
      {gameState === 'menu' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border-2 border-amber-200 bg-white p-6 shadow-xl">
            <h2 className="mb-2 text-xl font-bold text-slate-800">Tile Match</h2>
            <p className="mb-5 text-sm text-slate-500">Connect matching tiles with a direct line (no obstacles).</p>
            <div className="grid gap-3">
              {['easy', 'medium', 'hard', 'expert'].map((lv) => (
                <button
                  key={lv}
                  onClick={() => startGame(lv)}
                  className="rounded-xl border-2 border-slate-300 bg-white px-4 py-3 text-sm font-bold uppercase text-slate-700 transition hover:border-cyan-500 hover:bg-cyan-50"
                >
                  {lv === 'easy' ? '4×10 Easy' : lv === 'medium' ? '6×10 Medium' : lv === 'hard' ? '8×10 Hard' : '10×10 Expert'}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div>
        <div
          className="mx-auto grid gap-0 rounded-md border-2 border-slate-700 bg-slate-700 p-0"
          style={{
            gridTemplateColumns: `repeat(${cols}, ${tileSize}rem)`,
            width: '100%',
            justifyContent: 'center',
          }}
        >
          {grid.map((symbol, idx) => {
            const isRemoved = removed.has(idx)
            const isSelected = selected.includes(idx)
            return (
              <button
                key={idx}
                onClick={() => toggleTile(idx)}
                disabled={isRemoved || gameState !== 'playing'}
                style={{
                  width: `${tileSize}rem`,
                  height: `${tileSize}rem`,
                  fontSize: tileSize >= 2.5 ? '1rem' : '0.875rem',
                }}
                className={`rounded border-2 font-bold transition disabled:opacity-0 ${
                  isSelected
                    ? 'scale-110 border-cyan-400 bg-cyan-200'
                    : 'border-slate-600 bg-white hover:scale-105 hover:border-cyan-500'
                }`}
              >
                {!isRemoved && symbol}
              </button>
            )
          })}
        </div>
      </div>

      {burst.map((particle, i) => (
        <div
          key={i}
          className="pointer-events-none fixed text-2xl"
          style={{
            left: particle.x,
            top: particle.y,
            opacity: particle.life,
            transform: `translate(${particle.vx * 2}px, ${particle.vy * 2}px)`,
          }}
        >
          ✨
        </div>
      ))}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {gameState === 'won' && (
          <p className="rounded-full bg-emerald-100 px-4 py-2 text-sm font-bold text-emerald-700">
            🎉 All tiles cleared!
          </p>
        )}
        {gameState !== 'menu' && (
          <button
            type="button"
            onClick={() => setGameState('menu')}
            className="rounded-full bg-slate-900 px-4 py-2 text-sm font-bold text-white transition hover:bg-slate-700"
          >
            New Game
          </button>
        )}
      </div>
    </section>
  )
}
