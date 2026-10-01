const invalid = () => ({ correct: false, reason: 'invalid' })
const wrong = () => ({ correct: false, reason: 'wrong' })
const right = () => ({ correct: true, reason: null })
const POINTS_PER_MODE = { point: 1, line: 2, parabola: 3 }
const MAX_TOLERANCE = 0.25

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function validBounds(bound) {
  return isPlainObject(bound) && Object.keys(bound).length === 4 &&
    ['xMin', 'xMax', 'yMin', 'yMax'].every((key) => Number.isFinite(bound[key])) &&
    bound.xMin < bound.xMax && bound.yMin < bound.yMax
}

function isGraphPoint(point, bound) {
  return isPlainObject(point) && Object.keys(point).length === 2 &&
    Number.isFinite(point.x) && Number.isFinite(point.y) &&
    point.x >= bound.xMin && point.x <= bound.xMax &&
    point.y >= bound.yMin && point.y <= bound.yMax
}

function validateAnswer(answer) {
  const count = POINTS_PER_MODE[answer?.mode]
  if (!isPlainObject(answer) || Object.keys(answer).length !== 4 || count === undefined ||
    !Array.isArray(answer.points) || answer.points.length !== count || !validBounds(answer.bound) ||
    !Number.isFinite(answer.tolerance) || answer.tolerance < 0 || answer.tolerance > MAX_TOLERANCE) {
    throw new TypeError('graph answer must have a mode, points, bounds, and bounded tolerance')
  }
  if (answer.points.some((point) => !isGraphPoint(point, answer.bound))) {
    throw new TypeError('graph answer points must be finite and in bounds')
  }
  if (count > 1 && new Set(answer.points.map(({ x }) => x)).size !== count) {
    throw new TypeError('graph answer points must have unique x-coordinates')
  }
}

function validResponse(response, answer) {
  return isPlainObject(response) && Object.keys(response).length === 1 &&
    Object.hasOwn(response, 'points') && Array.isArray(response.points) &&
    response.points.length === answer.points.length &&
    response.points.every((point) => isGraphPoint(point, answer.bound)) &&
    (answer.mode === 'point' || new Set(response.points.map(({ x }) => x)).size === response.points.length)
}

function pointDistance(left, right) {
  return Math.hypot(left.x - right.x, left.y - right.y)
}

function pointVerdict(answer, response) {
  return pointDistance(answer.points[0], response.points[0]) <= answer.tolerance ? right() : wrong()
}

function lineCoefficients(points) {
  const [first, second] = points
  const slope = (second.y - first.y) / (second.x - first.x)
  return { slope, intercept: first.y - slope * first.x }
}

function parabolaCoefficients(points) {
  const [first, second, third] = [...points].sort((left, right) => left.x - right.x)
  const firstSlope = (second.y - first.y) / (second.x - first.x)
  const secondSlope = (third.y - second.y) / (third.x - second.x)
  const a = (secondSlope - firstSlope) / (third.x - first.x)
  const b = firstSlope - a * (first.x + second.x)
  return { a, b, c: first.y - a * first.x ** 2 - b * first.x }
}

function curveVerdict(answer, response) {
  const fit = answer.mode === 'line' ? lineCoefficients : parabolaCoefficients
  const keys = answer.mode === 'line' ? ['slope', 'intercept'] : ['a', 'b', 'c']
  const expected = fit(answer.points)
  const actual = fit(response.points)
  return keys.every((key) => Math.abs(expected[key] - actual[key]) <= answer.tolerance) ? right() : wrong()
}

export function checkGraph(answer, response) {
  validateAnswer(answer)
  if (!validResponse(response, answer)) return invalid()
  return answer.mode === 'point' ? pointVerdict(answer, response) : curveVerdict(answer, response)
}
