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
  if (!answer || typeof answer !== 'object' || Array.isArray(answer) || !Array.isArray(answer.blanks) || answer.blanks.length === 0) {
    throw new TypeError('cloze answer must have non-empty accept lists for every blank')
  }
  for (let index = 0; index < answer.blanks.length; index++) {
    const blank = answer.blanks[index]
    if (!blank || typeof blank !== 'object' || Array.isArray(blank) || !Array.isArray(blank.accept) || blank.accept.length === 0) {
      throw new TypeError('cloze answer must have non-empty accept lists for every blank')
    }
    for (let acceptIndex = 0; acceptIndex < blank.accept.length; acceptIndex++) {
      const entry = blank.accept[acceptIndex]
      if (typeof entry !== 'string' || entry.trim().length === 0) {
        throw new TypeError('cloze answer must have non-empty accept lists for every blank')
      }
    }
  }
  if (!response || typeof response !== 'object' || Array.isArray(response) || !Array.isArray(response.blanks) || response.blanks.length !== answer.blanks.length) return invalid()
  for (let index = 0; index < response.blanks.length; index++) {
    const text = response.blanks[index]
    if (typeof text !== 'string' || text.trim().length === 0) return invalid()
  }
  for (let index = 0; index < response.blanks.length; index++) {
    const text = response.blanks[index]
    let matches = false
    for (let acceptIndex = 0; acceptIndex < answer.blanks[index].accept.length; acceptIndex++) {
      if (normalize(answer.blanks[index].accept[acceptIndex]) === normalize(text)) matches = true
    }
    if (!matches) return wrong()
  }
  return right()
}

function order(answer, response) {
  if (!answer || typeof answer !== 'object' || Array.isArray(answer) || !Array.isArray(answer.sequence) || answer.sequence.length === 0) {
    throw new TypeError('order answer must have a non-empty sequence of unique ids')
  }
  const answerIds = new Set(answer.sequence)
  if (answerIds.size !== answer.sequence.length || answer.sequence.some((id) => typeof id !== 'string' || id.length === 0)) {
    throw new TypeError('order answer must have a non-empty sequence of unique ids')
  }
  if (!response || typeof response !== 'object' || Array.isArray(response) || !Array.isArray(response.sequence) || response.sequence.length !== answer.sequence.length) return invalid()
  const responseIds = new Set(response.sequence)
  if (responseIds.size !== response.sequence.length || response.sequence.some((id) => typeof id !== 'string' || !answerIds.has(id))) return invalid()
  return response.sequence.every((id, index) => id === answer.sequence[index]) ? right() : wrong()
}

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function sort(answer, response) {
  if (!isPlainObject(answer) || !isPlainObject(answer.buckets) || Object.keys(answer.buckets).length === 0) {
    throw new TypeError('sort answer must have non-empty buckets')
  }

  const answerIds = new Set()
  let answerCount = 0
  for (const ids of Object.values(answer.buckets)) {
    if (!Array.isArray(ids)) throw new TypeError('sort answer buckets must be arrays of unique non-empty ids')
    for (const id of ids) {
      if (typeof id !== 'string' || id.length === 0 || answerIds.has(id)) {
        throw new TypeError('sort answer buckets must be arrays of unique non-empty ids')
      }
      answerIds.add(id)
      answerCount++
    }
  }
  if (answerCount === 0) throw new TypeError('sort answer must contain at least one item id')

  if (!isPlainObject(response) || !isPlainObject(response.buckets)) return invalid()
  const answerBucketIds = Object.keys(answer.buckets)
  const responseBucketIds = Object.keys(response.buckets)
  if (responseBucketIds.length !== answerBucketIds.length || responseBucketIds.some((id) => !Object.hasOwn(answer.buckets, id))) {
    return invalid()
  }

  const responseIds = new Set()
  let responseCount = 0
  for (const ids of Object.values(response.buckets)) {
    if (!Array.isArray(ids)) return invalid()
    for (const id of ids) {
      if (typeof id !== 'string' || !answerIds.has(id) || responseIds.has(id)) return invalid()
      responseIds.add(id)
      responseCount++
    }
  }
  if (responseCount !== answerCount) return invalid()

  for (const bucketId of answerBucketIds) {
    const expected = new Set(answer.buckets[bucketId])
    const actual = new Set(response.buckets[bucketId])
    if (expected.size !== actual.size || [...expected].some((id) => !actual.has(id))) return wrong()
  }
  return right()
}

export function check(widget, answer, response) {
  if (widget === 'choice') return choice(answer, response)
  if (widget === 'number') return number(answer, response)
  if (widget === 'column') return number(answer, response)
  if (widget === 'fraction') return fraction(answer, response)
  if (widget === 'cloze') return cloze(answer, response)
  if (widget === 'order') return order(answer, response)
  if (widget === 'sort') return sort(answer, response)
  throw new Error(`unknown widget: ${String(widget)}`)
}
