function wordsIn(text) {
  return text.toLowerCase().match(/[a-z]+(?:'[a-z]+)?/g) || []
}

function syllableCount(word) {
  const normalized = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '').replace(/^y/, '')
  const groups = normalized.match(/[aeiouy]+/g)
  return Math.max(1, groups?.length || 0)
}

function sentenceCount(text) {
  return Math.max(1, (text.match(/[.!?]+(?=\s|$)/g) || []).length)
}

export function readabilityGrade(text) {
  if (typeof text !== 'string' || !text.trim()) throw new TypeError('Passage text must be a non-empty string')
  const words = wordsIn(text)
  if (words.length === 0) throw new TypeError('Passage text must contain readable words')
  const syllables = words.reduce((total, word) => total + syllableCount(word), 0)
  const grade = 0.39 * (words.length / sentenceCount(text)) + 11.8 * (syllables / words.length) - 15.59
  return Number.isFinite(grade) ? Math.max(0, grade) : 0
}

export function fitsGradeBand(text, grade) {
  if (!Number.isInteger(grade) || grade < 1 || grade > 12) throw new RangeError('Target grade must be between 1 and 12')
  return Math.abs(readabilityGrade(text) - grade) <= 1.5
}
