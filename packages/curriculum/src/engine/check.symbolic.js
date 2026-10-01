import { equivalentExpression, hasFactoredForm } from './symbolic.js'

const invalid = () => ({ correct: false, reason: 'invalid' })
const wrong = () => ({ correct: false, reason: 'wrong' })
const right = () => ({ correct: true, reason: null })

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function validateExpressionAnswer(answer) {
  if (!isPlainObject(answer) || typeof answer.expression !== 'string' ||
    Object.keys(answer).some((key) => !['grammar', 'expression', 'form'].includes(key))) {
    throw new TypeError('expression answer must have a grammar and expression')
  }
  if (answer.grammar !== 'polynomial' && answer.grammar !== 'rational') {
    throw new TypeError(`unsupported expression grammar: ${String(answer.grammar)}`)
  }
  if (answer.form !== undefined && answer.form !== 'factored') throw new TypeError('expression form is unsupported')
  equivalentExpression(answer.grammar, answer.expression, answer.expression)
}

function expressionMatches(answer, text) {
  const matches = equivalentExpression(answer.grammar, answer.expression, text)
  return matches && (answer.form !== 'factored' || hasFactoredForm(text))
}

function isInvalidChildExpression(error) {
  return error instanceof SyntaxError || error instanceof RangeError
}

export function checkExpression(answer, response) {
  validateExpressionAnswer(answer)
  if (!isPlainObject(response) || Object.keys(response).length !== 1 || typeof response.text !== 'string') return invalid()
  try {
    return expressionMatches(answer, response.text) ? right() : wrong()
  } catch (error) {
    if (isInvalidChildExpression(error)) return invalid()
    throw error
  }
}

export function checkSteps(answer, response) {
  if (!isPlainObject(answer) || Object.keys(answer).length !== 1 || !Array.isArray(answer.steps) || answer.steps.length === 0) {
    throw new TypeError('steps answer must have a non-empty list of expressions')
  }
  for (const step of answer.steps) validateExpressionAnswer(step)
  if (!isPlainObject(response) || Object.keys(response).length !== 1 || !Array.isArray(response.steps) || response.steps.length !== answer.steps.length) return invalid()
  if (response.steps.some((step) => typeof step !== 'string' || step.trim().length === 0)) return invalid()
  const matches = []
  for (let index = 0; index < answer.steps.length; index++) {
    try {
      matches.push(expressionMatches(answer.steps[index], response.steps[index]))
    } catch (error) {
      if (isInvalidChildExpression(error)) return invalid()
      throw error
    }
  }
  return matches.every(Boolean) ? right() : wrong()
}
