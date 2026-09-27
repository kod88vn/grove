export function sudokuCellLabel(row, col) {
  return `Row ${row + 1}, column ${col + 1}`
}

export function crosswordCellLabel(row, col, clue) {
  if (clue == null) return sudokuCellLabel(row, col)
  return `Clue ${clue}, row ${row + 1}, column ${col + 1}`
}

export function memoryCardLabel({ index, symbol, faceUp, matched }) {
  if (matched) return `Card ${index + 1}, ${symbol}, matched`
  if (faceUp) return `Card ${index + 1}, ${symbol}`
  return `Card ${index + 1}, face down`
}
