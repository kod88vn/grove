import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { crosswordCellLabel, memoryCardLabel, sudokuCellLabel } from './cellLabels.js'

// Screen readers announced every Sudoku/Crossword cell as an unnamed "edit
// text" and every face-down Memory card as "question mark". These labels give
// each control a position (and state, for Memory) without leaking answers.

function source(file) {
  return readFileSync(new URL(`./${file}`, import.meta.url), 'utf8')
}

// The JSX of the element that contains `marker`, from its opening `open` to
// the next `close`.
function elementAround(src, marker, open, close) {
  const at = src.indexOf(marker)
  assert.notEqual(at, -1, `marker not found: ${marker}`)
  const start = src.lastIndexOf(open, at)
  const end = src.indexOf(close, at)
  assert.ok(start !== -1 && end !== -1, `element around ${marker} not found`)
  return src.slice(start, end)
}

function importsFromCellLabels(src, name) {
  return new RegExp(`import\\s*\\{[^}]*\\b${name}\\b[^}]*\\}\\s*from\\s*'\\./cellLabels(\\.js)?'`).test(src)
}

describe('sudokuCellLabel', () => {
  it('names a cell by 1-based row and column', () => {
    assert.equal(sudokuCellLabel(0, 0), 'Row 1, column 1')
    assert.equal(sudokuCellLabel(2, 3), 'Row 3, column 4')
  })

  it('gives every cell of a 4x4 board a distinct name', () => {
    const labels = new Set()
    for (let row = 0; row < 4; row += 1) {
      for (let col = 0; col < 4; col += 1) labels.add(sudokuCellLabel(row, col))
    }
    assert.equal(labels.size, 16)
  })
})

describe('crosswordCellLabel', () => {
  it('names a plain cell by 1-based row and column', () => {
    assert.equal(crosswordCellLabel(0, 2), 'Row 1, column 3')
    assert.equal(crosswordCellLabel(0, 2, undefined), 'Row 1, column 3')
    assert.equal(crosswordCellLabel(0, 2, null), 'Row 1, column 3')
  })

  it('leads with the clue number when a word starts in the cell', () => {
    assert.equal(crosswordCellLabel(0, 2, 4), 'Clue 4, row 1, column 3')
  })
})

describe('memoryCardLabel', () => {
  it('does not reveal the symbol of a face-down card', () => {
    const label = memoryCardLabel({ index: 0, symbol: '🐶', faceUp: false, matched: false })
    assert.equal(label, 'Card 1, face down')
    assert.ok(!label.includes('🐶'))
  })

  it('names the symbol of a face-up card', () => {
    assert.equal(memoryCardLabel({ index: 4, symbol: '🐱', faceUp: true, matched: false }), 'Card 5, 🐱')
  })

  it('marks a matched card as matched', () => {
    assert.equal(memoryCardLabel({ index: 15, symbol: '🐼', faceUp: false, matched: true }), 'Card 16, 🐼, matched')
    assert.equal(memoryCardLabel({ index: 15, symbol: '🐼', faceUp: true, matched: true }), 'Card 16, 🐼, matched')
  })
})

describe('games wire the labels onto their cells', () => {
  it('SudokuGame labels each board input', () => {
    const src = source('SudokuGame.js')
    assert.ok(importsFromCellLabels(src, 'sudokuCellLabel'), 'SudokuGame must import sudokuCellLabel from ./cellLabels')
    const input = elementAround(src, 'inputMode="numeric"', '<input', '/>')
    assert.match(input, /aria-label=\{sudokuCellLabel\(rowIndex, colIndex\)\}/)
  })

  it('CrosswordGame labels each grid input', () => {
    const src = source('CrosswordGame.js')
    assert.ok(importsFromCellLabels(src, 'crosswordCellLabel'), 'CrosswordGame must import crosswordCellLabel from ./cellLabels')
    const input = elementAround(src, 'applyCellValue(row, col, event.target.value)', '<input', '/>')
    assert.match(input, /aria-label=\{crosswordCellLabel\(row, col, startEntry\?\.number \?\? startEntry\?\.id\)\}/)
  })

  it('MemoryGame labels each card button', () => {
    const src = source('MemoryGame.js')
    assert.ok(importsFromCellLabels(src, 'memoryCardLabel'), 'MemoryGame must import memoryCardLabel from ./cellLabels')
    const button = elementAround(src, 'handleFlip(index)}', '<button', '</button>')
    assert.match(button, /aria-label=\{memoryCardLabel\(\{ index, symbol: card\.symbol, faceUp: isFlipped, matched: isSolved \}\)\}/)
  })
})
