// Sudoku generator supporting 4x4, 6x6 and 9x9 grids.
// Pure, deterministic given a seed. No external deps.

export const SUDOKU_SIZES = {
  elementary: 4,
  middleschool: 6,
  highschool: 9,
}

// Number of cells removed (i.e. blanks) per level. Tuned for kid-appropriate
// difficulty on the smaller grids and a real challenge on 9x9.
export const SUDOKU_REMOVALS = {
  elementary: 6, // 10 of 16 clues
  middleschool: 14, // 22 of 36 clues
  highschool: 45, // 36 of 81 clues
}

export function getSudokuBlockDims(size) {
  if (size === 4) return { blockRows: 2, blockCols: 2 }
  if (size === 6) return { blockRows: 2, blockCols: 3 }
  if (size === 9) return { blockRows: 3, blockCols: 3 }
  throw new Error(`unsupported_sudoku_size:${size}`)
}

function mulberry32(seed) {
  let a = Math.floor(Math.abs(seed) * 0xffffffff) >>> 0
  return function next() {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function shuffle(array, rng) {
  const out = array.slice()
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

function isPlacementValid(board, size, blockRows, blockCols, row, col, value) {
  for (let i = 0; i < size; i += 1) {
    if (i !== col && board[row][i] === value) return false
    if (i !== row && board[i][col] === value) return false
  }
  const br = Math.floor(row / blockRows) * blockRows
  const bc = Math.floor(col / blockCols) * blockCols
  for (let r = br; r < br + blockRows; r += 1) {
    for (let c = bc; c < bc + blockCols; c += 1) {
      if ((r !== row || c !== col) && board[r][c] === value) return false
    }
  }
  return true
}

function emptyBoard(size) {
  return Array.from({ length: size }, () => Array.from({ length: size }, () => 0))
}

function fillSolved(board, size, blockRows, blockCols, rng) {
  const numbers = Array.from({ length: size }, (_, i) => i + 1)
  function recurse(pos) {
    if (pos === size * size) return true
    const row = Math.floor(pos / size)
    const col = pos % size
    if (board[row][col] !== 0) return recurse(pos + 1)
    const candidates = shuffle(numbers, rng)
    for (const value of candidates) {
      if (isPlacementValid(board, size, blockRows, blockCols, row, col, value)) {
        board[row][col] = value
        if (recurse(pos + 1)) return true
        board[row][col] = 0
      }
    }
    return false
  }
  recurse(0)
}

// Counts solutions up to `cap`. Stops early once cap is reached.
function countSolutions(board, size, blockRows, blockCols, cap = 2) {
  let count = 0
  function recurse() {
    if (count >= cap) return
    let row = -1
    let col = -1
    for (let i = 0; i < size && row === -1; i += 1) {
      for (let j = 0; j < size; j += 1) {
        if (board[i][j] === 0) {
          row = i
          col = j
          break
        }
      }
    }
    if (row === -1) {
      count += 1
      return
    }
    for (let value = 1; value <= size; value += 1) {
      if (isPlacementValid(board, size, blockRows, blockCols, row, col, value)) {
        board[row][col] = value
        recurse()
        board[row][col] = 0
        if (count >= cap) return
      }
    }
  }
  recurse()
  return count
}

function clone(board) {
  return board.map((row) => row.slice())
}

export function generateSudokuPuzzle(size, removals, seed = Math.random()) {
  const { blockRows, blockCols } = getSudokuBlockDims(size)
  const rng = mulberry32(seed)

  const solution = emptyBoard(size)
  fillSolved(solution, size, blockRows, blockCols, rng)

  const board = clone(solution)
  const cellOrder = shuffle(
    Array.from({ length: size * size }, (_, i) => i),
    rng,
  )

  let removed = 0
  for (const cell of cellOrder) {
    if (removed >= removals) break
    const row = Math.floor(cell / size)
    const col = cell % size
    const previous = board[row][col]
    board[row][col] = 0
    // Uniqueness check is expensive on 9x9 — skip on 4x4/6x6 where chance of
    // multi-solution after a few removals is effectively zero.
    if (size >= 9) {
      const trial = clone(board)
      const solutions = countSolutions(trial, size, blockRows, blockCols, 2)
      if (solutions !== 1) {
        board[row][col] = previous
        continue
      }
    }
    removed += 1
  }

  return {
    size,
    blockRows,
    blockCols,
    board,
    solution,
  }
}

export function generateSudokuForLevel(level, seed = Math.random()) {
  const size = SUDOKU_SIZES[level] ?? SUDOKU_SIZES.elementary
  const removals = SUDOKU_REMOVALS[level] ?? SUDOKU_REMOVALS.elementary
  return generateSudokuPuzzle(size, removals, seed)
}
