/** Sort quadrilaterals by whether they are always a target shape. */
const ALWAYS = {
  quadrilateral: ['Square', 'Rectangle', 'Rhombus', 'Parallelogram', 'Trapezoid', 'Kite'],
  parallelogram: ['Square', 'Rectangle', 'Rhombus', 'Parallelogram'],
  rectangle: ['Square', 'Rectangle'],
  rhombus: ['Square', 'Rhombus'],
}

const TARGETS = Object.keys(ALWAYS)
const SHAPES = [
  'Square',
  'Rectangle',
  'Rhombus',
  'Parallelogram',
  'Trapezoid',
  'Kite',
  'Triangle',
  'Pentagon',
  'Hexagon',
  'Octagon',
]

const hasMultipleBucketChanges = (labels, selectedAlways) => {
  let changes = 0
  for (let index = 1; index < labels.length; index++) {
    const wasAlways = selectedAlways.includes(labels[index - 1])
    const isAlways = selectedAlways.includes(labels[index])
    if (wasAlways !== isAlways) changes++
  }
  return changes >= 2
}

const makeProblem = (rng) => {
  const target = rng.pick(TARGETS)
  const always = rng.shuffle(ALWAYS[target])
  const notAlways = rng.shuffle(SHAPES.filter((shape) => !ALWAYS[target].includes(shape)))
  const trueCount = target === 'quadrilateral' || target === 'parallelogram' ? 3 : 2
  const selectedAlways = always.slice(0, trueCount)
  const selectedNotAlways = notAlways.slice(0, 6 - trueCount)
  let labels = rng.shuffle([...selectedAlways, ...selectedNotAlways])
  let attempts = 0
  while (!hasMultipleBucketChanges(labels, selectedAlways) && attempts < 20) {
    labels = rng.shuffle([...selectedAlways, ...selectedNotAlways])
    attempts++
  }
  if (!hasMultipleBucketChanges(labels, selectedAlways)) {
    labels = []
    for (let index = 0; index < selectedAlways.length; index++) {
      labels.push(selectedAlways[index], selectedNotAlways[index])
    }
    labels.push(...selectedNotAlways.slice(selectedAlways.length))
  }

  const buckets = rng.shuffle([
    { id: 'always', label: `Always a ${target}` },
    { id: 'not-always', label: `Not always a ${target}` },
  ])
  const items = labels.map((label, index) => ({ id: `item-${index}`, label }))
  const alwaysBucket = buckets.find((bucket) => bucket.id === 'always')
  const notAlwaysBucket = buckets.find((bucket) => bucket.id === 'not-always')

  return {
    prompt: `Sort each shape by whether it is always a ${target}.`,
    visual: { kind: 'sort', items, buckets },
    answer: {
      buckets: {
        always: items.filter((item) => selectedAlways.includes(item.label)).map((item) => item.id),
        'not-always': items.filter((item) => selectedNotAlways.includes(item.label)).map((item) => item.id),
      },
    },
    hints: [
      'Look for properties that every shape in a category must have.',
      'A shape can be in a smaller category without every shape in the larger category fitting inside it.',
    ],
    explanation: `${alwaysBucket.label}: ${selectedAlways.join(', ')}. ${notAlwaysBucket.label}: ${selectedNotAlways.join(', ')}.`,
  }
}

export const templates = [{
  id: 'm5.g.classify-shapes/sort-quadrilaterals',
  skill: 'm5.g.classify-shapes',
  title: 'Sort Quadrilaterals',
  widget: 'sort',
  version: 1,
  difficulty: 2,
  generate: makeProblem,
}]
