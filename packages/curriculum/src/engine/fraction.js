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

function safeProduct(a, b) {
  const value = a * b
  if (!Number.isSafeInteger(value)) throw new RangeError('fraction arithmetic exceeded safe integers')
  return value
}

function makeFraction(num, den) {
  if (!validPart(num) || !validPart(den) || den === 0) {
    throw new RangeError('fraction arithmetic exceeded safe integers')
  }
  return reduce({ num, den })
}

export function parseFraction(text) {
  if (typeof text !== 'string') return null
  const value = text.trim()
  let match = /^(-?)(\d+)\/(\d+)$/.exec(value)
  if (match) {
    const num = Number(`${match[1]}${match[2]}`)
    const den = Number(match[3])
    return validPart(num) && validPart(den) && den !== 0 ? { num, den } : null
  }
  match = /^(-?)(\d+)(?: +(\d+)\/(\d+))?$/.exec(value)
  if (!match) return null
  const whole = Number(`${match[1]}${match[2]}`)
  if (!match[3]) return validPart(whole) ? { num: whole, den: 1 } : null
  const part = Number(match[3])
  const den = Number(match[4])
  if (!validPart(whole) || !validPart(part) || !validPart(den) || den === 0 || part === 0 || part >= den) return null
  const product = Math.abs(whole) * den
  if (!Number.isSafeInteger(product)) return null
  const numerator = product + part
  if (!Number.isSafeInteger(numerator)) return null
  return { num: whole < 0 ? -numerator : numerator, den }
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
  const numerator = safeProduct(left.num, right.den) + safeProduct(right.num, left.den)
  return makeFraction(numerator, safeProduct(left.den, right.den))
}

export function sub(left, right) {
  return add(left, { num: -right.num, den: right.den })
}

export function mul(left, right) {
  validateFraction(left); validateFraction(right)
  return makeFraction(safeProduct(left.num, right.num), safeProduct(left.den, right.den))
}

export function div(left, right) {
  validateFraction(left); validateFraction(right)
  if (right.num === 0) throw new RangeError('cannot divide by zero')
  return makeFraction(safeProduct(left.num, right.den), safeProduct(left.den, right.num))
}

export function format(value) {
  validateFraction(value)
  return value.den === 1 ? String(value.num) : `${value.num}/${value.den}`
}