import { add as addFraction, div as divideFraction, equals, mul as multiplyFraction, sub as subtractFraction } from './fraction.js'

const ZERO = { num: 0, den: 1 }
const ONE = { num: 1, den: 1 }
const MAX_MULTIPLICATION_WORK = 4096

export function constant(value) {
  return value.num === 0 ? new Map() : new Map([['', value]])
}

export function variable(name) {
  return new Map([[name, ONE]])
}

export function isZero(polynomial) {
  return polynomial.size === 0
}

export function add(left, right) {
  const result = new Map(left)
  for (const [monomial, coefficient] of right) {
    const sum = addFraction(result.get(monomial) ?? ZERO, coefficient)
    if (sum.num === 0) result.delete(monomial)
    else result.set(monomial, sum)
  }
  return result
}

export function subtract(left, right) {
  const result = new Map(left)
  for (const [monomial, coefficient] of right) {
    const difference = subtractFraction(result.get(monomial) ?? ZERO, coefficient)
    if (difference.num === 0) result.delete(monomial)
    else result.set(monomial, difference)
  }
  return result
}

function factors(monomial) {
  if (monomial === '') return new Map()
  return new Map(monomial.split('*').map((factor) => {
    const [name, powerText] = factor.split('^')
    return [name, powerText === undefined ? 1 : Number(powerText)]
  }))
}

function productMonomial(left, right) {
  const powers = factors(left)
  for (const [name, power] of factors(right)) {
    const sum = (powers.get(name) ?? 0) + power
    if (!Number.isSafeInteger(sum)) throw new RangeError('polynomial exponent exceeds safe integers')
    powers.set(name, sum)
  }
  return [...powers].sort(([leftName], [rightName]) => leftName.localeCompare(rightName))
    .map(([name, power]) => power === 1 ? name : `${name}^${power}`)
    .join('*')
}

export function multiply(left, right) {
  if (right.size > 0 && left.size > MAX_MULTIPLICATION_WORK / right.size) {
    throw new RangeError('polynomial multiplication exceeds the work budget')
  }
  const result = new Map()
  for (const [leftMonomial, leftCoefficient] of left) {
    for (const [rightMonomial, rightCoefficient] of right) {
      const monomial = productMonomial(leftMonomial, rightMonomial)
      const coefficient = multiplyFraction(leftCoefficient, rightCoefficient)
      const sum = addFraction(result.get(monomial) ?? ZERO, coefficient)
      if (sum.num === 0) result.delete(monomial)
      else result.set(monomial, sum)
    }
  }
  return result
}

export function scale(polynomial, factor) {
  const result = new Map()
  for (const [monomial, coefficient] of polynomial) {
    const product = multiplyFraction(coefficient, factor)
    if (product.num !== 0) result.set(monomial, product)
  }
  return result
}

export function divideByConstant(polynomial, denominator) {
  return scale(polynomial, divideFraction(ONE, denominator))
}

export function power(polynomial, exponent) {
  let result = constant(ONE)
  let base = polynomial
  let remaining = exponent
  while (remaining > 0) {
    if (remaining % 2 === 1) result = multiply(result, base)
    remaining = Math.floor(remaining / 2)
    if (remaining > 0) base = multiply(base, base)
  }
  return result
}

export function isConstant(polynomial) {
  return [...polynomial.keys()].every((monomial) => monomial === '')
}

export function constantValue(polynomial) {
  return polynomial.get('') ?? ZERO
}

export function equal(left, right) {
  if (left.size !== right.size) return false
  for (const [monomial, coefficient] of left) {
    const other = right.get(monomial)
    if (!other || !equals(coefficient, other)) return false
  }
  return true
}
