import * as polynomial from './polynomial.js'

const MAX_EXPRESSION_LENGTH = 2048

function tokenize(source) {
  if (typeof source !== 'string' || source.length === 0 || source.length > MAX_EXPRESSION_LENGTH) {
    throw new SyntaxError('expression must be non-empty and within the supported length')
  }
  const tokens = []
  let offset = 0
  while (offset < source.length) {
    const character = source[offset]
    if (/\s/.test(character)) {
      offset++
      continue
    }
    const number = /^\d+/.exec(source.slice(offset))
    if (number) {
      const value = Number(number[0])
      if (!Number.isSafeInteger(value)) throw new SyntaxError('integer coefficient exceeds safe integers')
      tokens.push({ type: 'number', value })
      offset += number[0].length
      continue
    }
    const identifier = /^[A-Za-z][A-Za-z0-9_]*/.exec(source.slice(offset))
    if (identifier) {
      tokens.push({ type: 'variable', value: identifier[0] })
      offset += identifier[0].length
      continue
    }
    if ('+-*/^()'.includes(character)) {
      tokens.push({ type: character, value: character })
      offset++
      continue
    }
    throw new SyntaxError(`unsupported expression character: ${character}`)
  }
  if (tokens.length > 512) throw new SyntaxError('expression has too many tokens')
  return tokens
}

class ExpressionParser {
  constructor(tokens) {
    this.tokens = tokens
    this.index = 0
  }

  peek() {
    return this.tokens[this.index]
  }

  take(type) {
    if (this.peek()?.type !== type) throw new SyntaxError(`expected ${type}`)
    return this.tokens[this.index++]
  }

  parse() {
    const expression = this.sum()
    if (this.index !== this.tokens.length) throw new SyntaxError('unexpected expression token')
    return expression
  }

  primary() {
    const token = this.peek()
    if (token?.type === 'number' || token?.type === 'variable') {
      this.index++
      return { type: token.type, value: token.value }
    }
    if (token?.type === '(') {
      this.index++
      const expression = this.sum()
      this.take(')')
      return { type: 'group', expression }
    }
    throw new SyntaxError('expected a number, variable, or parenthesized expression')
  }

  power() {
    const base = this.primary()
    if (this.peek()?.type !== '^') return base
    this.index++
    const sign = this.peek()?.type === '-' ? (this.index++, -1) : 1
    return { type: 'power', base, exponent: this.take('number').value * sign }
  }

  unary() {
    if (this.peek()?.type === '+') {
      this.index++
      return this.unary()
    }
    if (this.peek()?.type === '-') {
      this.index++
      return { type: 'negate', value: this.unary() }
    }
    return this.power()
  }

  product() {
    let expression = this.unary()
    while (this.peek()?.type === '*' || this.peek()?.type === '/') {
      const operator = this.tokens[this.index++].type
      expression = { type: operator === '*' ? 'multiply' : 'divide', left: expression, right: this.unary() }
    }
    return expression
  }

  sum() {
    let expression = this.product()
    while (this.peek()?.type === '+' || this.peek()?.type === '-') {
      const operator = this.tokens[this.index++].type
      expression = { type: operator === '+' ? 'add' : 'subtract', left: expression, right: this.product() }
    }
    return expression
  }
}

function parse(source) {
  return new ExpressionParser(tokenize(source)).parse()
}

const polynomialFraction = (value) => ({ numerator: value, denominator: polynomial.constant({ num: 1, den: 1 }) })

function requireDefinedValue(value) {
  if (polynomial.isZero(value.denominator)) throw new RangeError('expression has a zero polynomial denominator')
  return value
}

function rationalAdd(left, right, subtract = false) {
  const leftProduct = polynomial.multiply(left.numerator, right.denominator)
  const rightProduct = polynomial.multiply(right.numerator, left.denominator)
  return {
    numerator: subtract ? polynomial.subtract(leftProduct, rightProduct) : polynomial.add(leftProduct, rightProduct),
    denominator: polynomial.multiply(left.denominator, right.denominator),
  }
}

function evaluate(node) {
  if (node.type === 'number') return polynomialFraction(polynomial.constant({ num: node.value, den: 1 }))
  if (node.type === 'variable') return polynomialFraction(polynomial.variable(node.value))
  if (node.type === 'group') return evaluate(node.expression)
  if (node.type === 'negate') {
    const value = evaluate(node.value)
    return requireDefinedValue({
      numerator: polynomial.scale(value.numerator, { num: -1, den: 1 }),
      denominator: value.denominator,
    })
  }
  const left = evaluate(node.left ?? node.base)
  if (node.type === 'power') {
    requireDefinedValue(left)
    if (node.exponent === 0) return polynomialFraction(polynomial.constant({ num: 1, den: 1 }))
    const exponent = Math.abs(node.exponent)
    const numerator = polynomial.power(left.numerator, exponent)
    const denominator = polynomial.power(left.denominator, exponent)
    return requireDefinedValue(node.exponent > 0
      ? { numerator, denominator }
      : { numerator: denominator, denominator: numerator })
  }
  const right = evaluate(node.right)
  if (node.type === 'add' || node.type === 'subtract') {
    return requireDefinedValue(rationalAdd(left, right, node.type === 'subtract'))
  }
  if (node.type === 'multiply') {
    return requireDefinedValue({
      numerator: polynomial.multiply(left.numerator, right.numerator),
      denominator: polynomial.multiply(left.denominator, right.denominator),
    })
  }
  return requireDefinedValue({
    numerator: polynomial.multiply(left.numerator, right.denominator),
    denominator: polynomial.multiply(left.denominator, right.numerator),
  })
}

function asPolynomial(value) {
  if (!polynomial.isConstant(value.denominator)) throw new SyntaxError('polynomial grammar only permits division by a constant')
  const divisor = polynomial.constantValue(value.denominator)
  if (divisor.num === 0) throw new SyntaxError('division by zero')
  return polynomial.divideByConstant(value.numerator, divisor)
}

function validateGrammar(grammar) {
  if (grammar !== 'polynomial' && grammar !== 'rational') throw new TypeError(`unsupported expression grammar: ${String(grammar)}`)
}

function checkedValue(grammar, expression) {
  validateGrammar(grammar)
  const value = evaluate(parse(expression))
  if (polynomial.isZero(value.denominator)) throw new RangeError('expression has a zero polynomial denominator')
  return grammar === 'polynomial' ? polynomialFraction(asPolynomial(value)) : value
}

export function equivalentExpression(grammar, expected, candidate) {
  const left = checkedValue(grammar, expected)
  const right = checkedValue(grammar, candidate)
  if (grammar === 'polynomial') return polynomial.equal(left.numerator, right.numerator)
  return polynomial.equal(
    polynomial.multiply(left.numerator, right.denominator),
    polynomial.multiply(right.numerator, left.denominator),
  )
}

function flattenProducts(node, factors) {
  if (node.type === 'multiply') {
    flattenProducts(node.left, factors)
    flattenProducts(node.right, factors)
  } else {
    factors.push(node)
  }
}

function isGenuineGroupedFactor(factor) {
  if (factor.type !== 'group') return false
  const expanded = evaluate(factor.expression)
  return expanded.denominator.size === 1 && !polynomial.isConstant(expanded.numerator)
}

function isNonzeroScalarFactor(factor) {
  const value = evaluate(factor)
  return polynomial.isConstant(value.numerator) && !polynomial.isZero(value.numerator) &&
    polynomial.isConstant(value.denominator) && !polynomial.isZero(value.denominator)
}

export function hasFactoredForm(expression) {
  const factors = []
  flattenProducts(parse(expression), factors)
  const genuineFactors = factors.filter(isGenuineGroupedFactor)
  return genuineFactors.length >= 2 && factors.every((factor) =>
    isGenuineGroupedFactor(factor) || isNonzeroScalarFactor(factor))
}
