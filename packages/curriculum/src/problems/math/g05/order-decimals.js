const makeFractions = (rng) => {
  const short = rng.int(2, 9)
  let long = rng.int(11, short * 10 - 1)
  while (String(long).endsWith('0')) long = rng.int(11, short * 10 - 1)
  const fractions = new Set([String(short), String(long)])

  while (fractions.size < 4) {
    const candidate = String(rng.int(1, 999))
    if (!candidate.endsWith('0')) fractions.add(candidate)
  }

  return [...fractions]
}

const makeProblem = (rng) => {
  const whole = rng.int(0, 9)
  const direction = rng.pick(['least to greatest', 'greatest to least'])
  const labels = makeFractions(rng).map((fraction) => `${whole}.${fraction}`)
  const ascending = direction === 'least to greatest'
  const sorted = [...labels].sort((left, right) => Number(left) - Number(right))
  if (!ascending) sorted.reverse()

  let displayed = rng.shuffle(labels)
  while (displayed.every((label, index) => label === sorted[index])) displayed = rng.shuffle(labels)

  const items = displayed.map((label, index) => ({ id: `item-${index}`, label }))
  const idFor = new Map(items.map((item) => [item.label, item.id]))

  return {
    prompt: `Put the decimals in order from ${direction}.`,
    visual: { kind: 'order', items },
    answer: { sequence: sorted.map((label) => idFor.get(label)) },
    hints: [
      'Compare the whole-number parts first, then compare the digits after the decimal point.',
      'Use zero placeholders to compare decimal places, but do not change the value of a decimal.',
    ],
    explanation: `${sorted.join(` ${ascending ? '<' : '>'} `)}.`,
  }
}

export const templates = [
  {
    id: 'm5.nbt.compare-decimals/order-decimals',
    skill: 'm5.nbt.compare-decimals',
    title: 'Order Decimals',
    widget: 'order',
    version: 1,
    difficulty: 2,
    generate: makeProblem,
  },
]
