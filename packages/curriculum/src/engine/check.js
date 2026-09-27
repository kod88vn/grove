import { equals, isSimplest, parseFraction } from './fraction.js'

const invalid = () => ({ correct: false, reason: 'invalid' })
const wrong = () => ({ correct: false, reason: 'wrong' })
const right = () => ({ correct: true, reason: null })

function choice(answer, response) {
  if (!answer || typeof answer.id !== 'string' || answer.id.length === 0) throw new TypeError('choice answer must have an id')
  if (!response || typeof response !== 'object' || typeof response.id !== 'string') return invalid()
  return response.id === answer.id ? right() : wrong()
}

function decimal(text) {
  const trimmed = text.trim()
  if (!/^-?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/.test(trimmed)) return null
  const value = Number(trimmed.replaceAll(',', ''))
  return Number.isFinite(value) ? value : null
}

function number(answer, response) {
  if (!answer || typeof answer.value !== 'number' || !Number.isFinite(answer.value) || (answer.tolerance !== undefined && (!Number.isFinite(answer.tolerance) || answer.tolerance < 0))) {
    throw new TypeError('number answer must have a finite value and valid tolerance')
  }
  if (!response || typeof response !== 'object') return invalid()
  const value = typeof response.value === 'string' ? decimal(response.value) : response.value
  if (!Number.isFinite(value)) return invalid()
  const tolerance = answer.tolerance ?? 0
  return Math.abs(value - answer.value) <= tolerance ? right() : wrong()
}

function fraction(answer, response) {
  if (!answer || !Number.isSafeInteger(answer.num) || !Number.isSafeInteger(answer.den) || answer.den === 0) {
    throw new TypeError('fraction answer must have integer parts and a non-zero denominator')
  }
  if (!response || typeof response !== 'object' || typeof response.text !== 'string') return invalid()
  const value = parseFraction(response.text)
  if (!value) return invalid()
  if (!equals(value, answer)) return wrong()
  if (answer.simplest && !isSimplest(value)) return { correct: false, reason: 'not-simplest' }
  return right()
}

function normalize(text) {
  return text.trim().replace(/\s+/g, ' ').toLowerCase()
}

function cloze(answer, response) {
  if (!answer || typeof answer !== 'object' || Array.isArray(answer) || !Array.isArray(answer.blanks) || answer.blanks.length === 0 || answer.blanks.some(blank => !blank || typeof blank !== 'object' || Array.isArray(blank) || !Array.isArray(blank.accept) || blank.accept.length === 0 || blank.accept.some(entry => typeof entry !== 'string' || entry.trim().length === 0))) {
    throw new TypeError('cloze answer must have non-empty accept lists for every blank')
  }
  if (!response || typeof response !== 'object' || Array.isArray(response) || !Array.isArray(response.blanks) || response.blanks.length !== answer.blanks.length || response.blanks.some(text => typeof text !== 'string' || text.trim().length === 0)) return invalid()
  return response.blanks.every((text, index) => answer.blanks[index].accept.some(entry => normalize(entry) === normalize(text))) ? right() : wrong()
}

export function check(widget, answer, response) {
  if (widget === 'choice') return choice(answer, response)
  if (widget === 'number') return number(answer, response)
  if (widget === 'column') return number(answer, response)
  if (widget === 'fraction') return fraction(answer, response)
  if (widget === 'cloze') return cloze(answer, response)
  throw new Error(`unknown widget: ${String(widget)}`)
}