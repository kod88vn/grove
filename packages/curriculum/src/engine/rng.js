function validateSeed(seed) {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) {
    throw new RangeError('seed must be an integer from 0 to 2^32 - 1')
  }
}

function validateBounds(min, max) {
  if (!Number.isSafeInteger(min) || !Number.isSafeInteger(max) || min > max) {
    throw new RangeError('bounds must be ordered safe integers')
  }
}

export function createRng(seed) {
  validateSeed(seed)
  let state = seed | 0

  const next = () => {
    state = (state + 0x6D2B79F5) | 0
    let value = Math.imul(state ^ (state >>> 15), 1 | state)
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }

  const int = (min, max) => {
    validateBounds(min, max)
    return min + Math.floor(next() * (max - min + 1))
  }

  const pick = (items) => {
    if (!Array.isArray(items)) throw new TypeError('items must be an array')
    if (items.length === 0) throw new RangeError('cannot pick from an empty array')
    return items[int(0, items.length - 1)]
  }

  const shuffle = (items) => {
    if (!Array.isArray(items)) throw new TypeError('items must be an array')
    const result = [...items]
    for (let i = result.length - 1; i > 0; i--) {
      const j = int(0, i)
      ;[result[i], result[j]] = [result[j], result[i]]
    }
    return result
  }

  return { next, int, pick, shuffle }
}