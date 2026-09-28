const STRUCTURES = [
  {
    expression: (a, b, c) => `${a} × (${b} + ${c})`,
    description: (a, b, c) => `${a} times the sum of ${b} and ${c}`,
  },
  {
    expression: (a, b, c) => `${a} × ${b} + ${c}`,
    description: (a, b, c) => `${c} more than ${a} times ${b}`,
  },
  {
    expression: (a, b, c) => `${a} × (${b} − ${c})`,
    description: (a, b, c) => `${a} times the difference of ${b} and ${c}`,
  },
  {
    expression: (a, b, c) => `${a} × ${b} − ${c}`,
    description: (a, b, c) => `${c} less than ${a} times ${b}`,
  },
  {
    expression: (a, b, c) => `${a} + ${b} × ${c}`,
    description: (a, b, c) => `${a} more than ${b} times ${c}`,
  },
]

const TRIPLES = []
for (let a = 2; a <= 9; a++) {
  for (let b = 2; b <= 9; b++) {
    for (let c = 2; c < b; c++) {
      if (new Set([a, b, c]).size === 3) TRIPLES.push([a, b, c])
    }
  }
}

const makeProblem = (rng) => {
  const [a, b, c] = rng.pick(TRIPLES)
  const selected = rng.shuffle(STRUCTURES).slice(0, 4)
  const left = rng.shuffle(selected).map((structure, index) => ({
    id: `left-${index}`,
    label: structure.description(a, b, c),
    structure,
  }))
  const right = rng.shuffle(selected).map((structure, index) => ({
    id: `right-${index}`,
    label: structure.expression(a, b, c),
    structure,
  }))

  return {
    prompt: 'Match each description to the expression it describes.',
    visual: {
      kind: 'match',
      left: left.map(({ id, label }) => ({ id, label })),
      right: right.map(({ id, label }) => ({ id, label })),
    },
    answer: {
      pairs: left.map((leftCard) => ({
        left: leftCard.id,
        right: right.find((rightCard) => rightCard.structure === leftCard.structure).id,
      })),
    },
    hints: [
      'Read the words carefully: brackets change which operation happens first.',
      'Use the same three numbers and compare the operation described with the expression card.',
    ],
    explanation: left.map((card) => {
      const expression = right.find((rightCard) => rightCard.structure === card.structure).label
      return `"${card.label}" is ${expression}.`
    }).join(' '),
  }
}

export const templates = [{
  id: 'm5.oa.numeric-expressions/match-expressions',
  skill: 'm5.oa.numeric-expressions',
  title: 'Match Descriptions to Expressions',
  widget: 'match',
  version: 1,
  difficulty: 2,
  generate: makeProblem,
}]
