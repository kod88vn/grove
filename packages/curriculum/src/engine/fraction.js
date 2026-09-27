function validPart(value) {
  return Number.isSafeInteger(value)
}

function validateFraction(value) {
  if (!value || !validPart(value.num) || !validPart(value.den) || value.den === 0) {
    throw new RangeError('fraction parts must be safe integers with a non-zero denominator')
  }
}

function gcd(a, b) {
  a = Math.abs(a)
  b = Math.abs(b)
  while (b !== 0) [a, b] = [b, a % b]
  return a
}

function bigGcd(a, b) {
  if (a < 0n) a = -a
  if (b < 0n) b = -b
  while (b !== 0n) [a, b] = [b, a % b]
  return a
}

function makeBigFraction(num, den) {
  if (den === 0n) {
    throw new RangeError('fraction arithmetic exceeded safe integers')
  }
  if (num === 0n) return { num: 0, den: 1 }
  const divisor = bigGcd(num, den)
  if (den < 0n) {
    num = -num
    den = -den
  }
  num /= divisor
  den /= divisor
  const limit = BigInt(Number.MAX_SAFE_INTEGER)
  if (num < -limit || num > limit || den > limit) {
    throw new RangeError('fraction arithmetic exceeded safe integers')
  }
  return { num: Number(num), den: Number(den) }
}

export function parseFraction(text) {
  if (typeof text !== 'string') return null
  const value = text.trim()
  let match = /^(-?)(\d+)\/(\d+)$/.exec(value)
  if (match) {
    const num = Number(match[2]) * (match[1] === '-' ? -1 : 1)
    const den = Number(match[3])
    return validPart(num) && validPart(den) && den !== 0 ? { num: num === 0 ? 0 : num, den } : null
  }
  match = /^(-?)(\d+)(?: +(\d+)\/(\d+))?$/.exec(value)
  if (!match) return null
  const sign = match[1] === '-' ? -1 : 1
  const whole = Number(match[2]) * sign
  if (!match[3]) return validPart(whole) ? { num: whole === 0 ? 0 : whole, den: 1 } : null
  const part = Number(match[3])
  const den = Number(match[4])
  if (!validPart(whole) || !validPart(part) || !validPart(den) || den === 0 || part === 0 || part >= den) return null
  const product = Math.abs(whole) * den
  if (!Number.isSafeInteger(product)) return null
  const numerator = product + part
  if (!Number.isSafeInteger(numerator)) return null
  return { num: sign * numerator, den }
}

export function reduce(value) {
  validateFraction(value)
  if (value.num === 0) return { num: 0, den: 1 }
  const sign = value.den < 0 ? -1 : 1
  const divisor = gcd(value.num, value.den)
  return { num: (value.num / divisor) * sign, den: Math.abs(value.den) / divisor }
}

export function isSimplest(value) {
  return validPart(value?.num) && validPart(value?.den) && value.den > 0 && gcd(value.num, value.den) === 1
}

export function equals(left, right) {
  validateFraction(left)
  validateFraction(right)
  return BigInt(left.num) * BigInt(right.den) === BigInt(right.num) * BigInt(left.den)
}

export function add(left, right) {
  validateFraction(left); validateFraction(right)
  const numerator = BigInt(left.num) * BigInt(right.den) + BigInt(right.num) * BigInt(left.den)
  const denominator = BigInt(left.den) * BigInt(right.den)
  return makeBigFraction(numerator, denominator)
}

export function sub(left, right) {
  validateFraction(left); validateFraction(right)
  const numerator = BigInt(left.num) * BigInt(right.den) - BigInt(right.num) * BigInt(left.den)
  const denominator = BigInt(left.den) * BigInt(right.den)
  return makeBigFraction(numerator, denominator)
}

export function mul(left, right) {
  validateFraction(left); validateFraction(right)
  return makeBigFraction(BigInt(left.num) * BigInt(right.num), BigInt(left.den) * BigInt(right.den))
}

export function div(left, right) {
  validateFraction(left); validateFraction(right)
  if (right.num === 0) throw new RangeError('cannot divide by zero')
  return makeBigFraction(BigInt(left.num) * BigInt(right.den), BigInt(left.den) * BigInt(right.num))
}

export function format(value) {
  validateFraction(value)
  return value.den === 1 ? String(value.num) : `${value.num}/${value.den}`
}
