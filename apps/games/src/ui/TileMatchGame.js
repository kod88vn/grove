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

  // Check horizontal line: same row, no tiles between
  if (r1 === r2) {
    const [minC, maxC] = c1 < c2 ? [c1, c2] : [c2, c1]
    for (let c = minC + 1; c < maxC; c++) {
      if (!removed.has(getIndex(r1, c, cols))) {
        return false // blocked by another tile
      }
    }
    return true
  }

  // Check vertical line: same column, no tiles between
  if (c1 === c2) {
    const [minR, maxR] = r1 < r2 ? [r1, r2] : [r2, r1]
    for (let r = minR + 1; r < maxR; r++) {
      if (!removed.has(getIndex(r, c1, cols))) {
        return false // blocked by another tile
      }
    }
    return true
  }

  // Check L-path: horizontal then vertical, or vertical then horizontal
  // Path 1: (r1,c1) -> (r1,c2) -> (r2,c2)
  // Corner tile doesn't need to be empty; just the path segments
  let path1Clear = true
  const [minC, maxC] = c1 < c2 ? [c1, c2] : [c2, c1]
  for (let c = minC + 1; c < maxC; c++) {
    if (!removed.has(getIndex(r1, c, cols))) {
      path1Clear = false
      break
    }
  }
  if (path1Clear) {
    const [minR, maxR] = r1 < r2 ? [r1, r2] : [r2, r1]
    for (let r = minR + 1; r < maxR; r++) {
      if (!removed.has(getIndex(r, c2, cols))) {
        path1Clear = false
        break
      }
    }
    if (path1Clear) return true
  }

  // Path 2: (r1,c1) -> (r2,c1) -> (r2,c2)
  let path2Clear = true
  const [minR2, maxR2] = r1 < r2 ? [r1, r2] : [r2, r1]
  for (let r = minR2 + 1; r < maxR2; r++) {
    if (!removed.has(getIndex(r, c1, cols))) {
      path2Clear = false
      break
    }
  }
  if (path2Clear) {
    const [minC2, maxC2] = c1 < c2 ? [c1, c2] : [c2, c1]
    for (let c = minC2 + 1; c < maxC2; c++) {
      if (!removed.has(getIndex(r2, c, cols))) {
        path2Clear = false
        break
      }
    }
    if (path2Clear) return true
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
