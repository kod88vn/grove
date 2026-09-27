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

export function check(widget, answer, response) {
  if (widget === 'choice') return choice(answer, response)
  if (widget === 'number') return number(answer, response)
  if (widget === 'fraction') return fraction(answer, response)
  throw new Error(`unknown widget: ${String(widget)}`)
}