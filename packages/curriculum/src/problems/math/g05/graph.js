const BOUNDS = {
  point: { xMin: 0, xMax: 10, yMin: 0, yMax: 10 },
  line: { xMin: -5, xMax: 5, yMin: -10, yMax: 10 },
  parabola: { xMin: -5, xMax: 5, yMin: -10, yMax: 10 },
}

function makePoint(rng) {
  const x = rng.int(1, 10)
  const y = rng.int(1, 10)
  return {
    prompt: `Plot the point with coordinates (${x}, ${y}) on the coordinate plane.`,
    visual: { kind: 'graph', mode: 'point', ...BOUNDS.point },
    answer: { mode: 'point', points: [{ x, y }], bound: BOUNDS.point, tolerance: 0.25 },
    hints: ['Use the first coordinate to move along the x-axis.', 'Move up to the second coordinate and plot the point.'],
    explanation: `The point is plotted ${x} units right and ${y} units up from the origin.`,
  }
}

function makeLine(rng) {
  const slope = rng.pick([-2, -1, 1, 2])
  const intercept = rng.int(-3, 3)
  const xs = rng.shuffle([-3, -2, -1, 0, 1, 2, 3]).slice(0, 2).sort((a, b) => a - b)
  const points = xs.map((x) => ({ x, y: slope * x + intercept }))
  const interceptText = intercept < 0 ? `- ${Math.abs(intercept)}` : `+ ${intercept}`
  return {
    prompt: `Plot two points on the line y = ${slope}x ${interceptText}.`,
    visual: { kind: 'graph', mode: 'line', ...BOUNDS.line },
    answer: { mode: 'line', points, bound: BOUNDS.line, tolerance: 0.15 },
    hints: ['Choose two different x-coordinates.', 'Use the same rate of change between the two points.'],
    explanation: `The line has slope ${slope} and crosses the y-axis at ${intercept}.`,
  }
}

function makeParabola(rng) {
  const a = rng.pick([-1, 1])
  const b = rng.int(-2, 2)
  const c = rng.int(-2, 2)
  const xs = rng.shuffle([-2, -1, 0, 1, 2]).slice(0, 3).sort((left, right) => left - right)
  const points = xs.map((x) => ({ x, y: a * x * x + b * x + c }))
  const bText = b < 0 ? `- ${Math.abs(b)}x` : `+ ${b}x`
  const cText = c < 0 ? `- ${Math.abs(c)}` : `+ ${c}`
  return {
    prompt: `Plot three points on the parabola y = ${a}x² ${bText} ${cText}.`,
    visual: { kind: 'graph', mode: 'parabola', ...BOUNDS.parabola },
    answer: { mode: 'parabola', points, bound: BOUNDS.parabola, tolerance: 0.15 },
    hints: ['A parabola is described by a quadratic rule.', 'Compare how the y-values change as x moves by equal amounts.'],
    explanation: `The plotted points follow the quadratic rule y = ${a}x² + ${b}x + ${c}.`,
  }
}

export const templates = [
  {
    id: 'm5.g.coordinate-plane/plot-point', skill: 'm5.g.coordinate-plane', title: 'Plot a Point',
    difficulty: 1, widget: 'graph', version: 1, generate: makePoint,
  },
  {
    id: 'm5.oa.variables/graph-line', skill: 'm5.oa.variables', title: 'Plot a Line',
    difficulty: 2, widget: 'graph', version: 1, generate: makeLine,
  },
  {
    id: 'm5.oa.variables/graph-parabola', skill: 'm5.oa.variables', title: 'Plot a Parabola',
    difficulty: 3, widget: 'graph', version: 1, generate: makeParabola,
  },
]
