// Shape Scout boss: read a rectangle off the coordinate plane, then measure it.
// Combines plotting fluency (the path's coordinate-plane skill) with the
// perimeter/area arithmetic the classify-shapes strand builds.
function generateCoordinateBoss(rng) {
  const width = rng.int(3, 12)
  const height = rng.int(2, 9)
  const perimeter = 2 * (width + height)
  const area = width * height
  return {
    prompt: `👑 Boss quest: a rectangle sits on the grid with corners at (0, 0), (${width}, 0), (${width}, ${height}), and (0, ${height}). Find its side lengths, then its perimeter and area.`,
    visual: {
      kind: 'steps',
      items: [
        { id: 'step-1', label: 'Step 1: find the length (top and bottom sides)' },
        { id: 'step-2', label: 'Step 2: find the perimeter' },
        { id: 'step-3', label: 'Step 3: find the area' },
      ],
    },
    answer: {
      steps: [
        { grammar: 'polynomial', expression: String(width) },
        { grammar: 'polynomial', expression: `2 * (${width} + ${height})` },
        { grammar: 'polynomial', expression: String(area) },
      ],
    },
    hints: [
      'The length is how far the top side runs from (0, 0) to (' + width + ', 0).',
      `The height is ${height}, so the perimeter is 2 times (length + height).`,
      'The area is length times height.',
    ],
    explanation: `The sides are ${width} and ${height}, so the perimeter is ${perimeter} and the area is ${area}.`,
  }
}

export const templates = [{
  id: 'm5.g.coordinate-plane/rectangle-boss',
  skill: 'm5.g.coordinate-plane',
  title: 'Boss: Measure a Grid Rectangle',
  difficulty: 3,
  widget: 'steps',
  version: 1,
  generate: generateCoordinateBoss,
}]
