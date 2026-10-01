const CASES = [
  { rightAngles: true, equalSides: true, name: 'square' },
  { rightAngles: true, equalSides: false, name: 'rectangle' },
  { rightAngles: false, equalSides: true, name: 'rhombus' },
  { rightAngles: false, equalSides: false, name: 'parallelogram' },
]

function makeProblem(rng) {
  const selected = rng.pick(CASES)
  const rightAngleClue = selected.rightAngles
    ? 'It has four right angles.'
    : 'It has no right angles.'
  const equalSideClue = selected.equalSides
    ? 'All four sides are equal.'
    : 'Not all four sides are equal.'

  return {
    prompt: `Name the most specific name for this figure. It has two pairs of parallel sides. ${rightAngleClue} ${equalSideClue}`,
    visual: null,
    answer: { accept: [selected.name, `a ${selected.name}`] },
    hints: [
      'Use all three properties together.',
      'Choose the most specific name that fits every property.',
    ],
    explanation: `${selected.name} has the three stated properties.`,
  }
}

export const templates = [{
  id: 'm5.g.classify-shapes/name-the-quadrilateral',
  skill: 'm5.g.classify-shapes',
  title: 'Name the Quadrilateral',
  widget: 'text',
  version: 1,
  difficulty: 2,
  generate: makeProblem,
}]
