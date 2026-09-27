const gcd = (a, b) => {
  let left = a
  let right = b
  while (right) {
    [left, right] = [right, left % right]
  }
  return left
}

const coprime = (a, b) => gcd(a, b) === 1

const numerator = (rng, denominator) => {
  const choices = Array.from({ length: denominator - 1 }, (_, index) => index + 1)
    .filter((value) => coprime(value, denominator))
  return rng.pick(choices)
}

const makeProblem = (rng, pairs) => {
  const [d1, d2] = rng.pick(pairs)
  const n1 = numerator(rng, d1)
  const n2 = numerator(rng, d2)
  const lcd = (d1 / gcd(d1, d2)) * d2
  const rewritten1 = n1 * (lcd / d1)
  const rewritten2 = n2 * (lcd / d2)
  const unreducedNum = rewritten1 + rewritten2
  const divisor = gcd(unreducedNum, lcd)
  const num = unreducedNum / divisor
  const den = lcd / divisor

  return {
    prompt: `Add: ${n1}/${d1} + ${n2}/${d2}`,
    visual: {
      kind: 'fraction-sum',
      operator: '+',
      addends: [{ num: n1, den: d1 }, { num: n2, den: d2 }],
      lcd,
    },
    answer: { num, den, simplest: true },
    hints: [
      `The lowest common denominator of ${d1} and ${d2} is ${lcd}.`,
      `Rewrite both fractions over ${lcd}, add the numerators, then simplify.`,
    ],
    explanation: divisor === 1
      ? `${n1}/${d1} = ${rewritten1}/${lcd} and ${n2}/${d2} = ${rewritten2}/${lcd}, so ${rewritten1}/${lcd} + ${rewritten2}/${lcd} = ${num}/${den}.`
      : `${n1}/${d1} = ${rewritten1}/${lcd} and ${n2}/${d2} = ${rewritten2}/${lcd}, so ${rewritten1}/${lcd} + ${rewritten2}/${lcd} = ${unreducedNum}/${lcd} = ${num}/${den}.`,
  }
}

const multiplePairs = [
  [2, 4], [2, 6], [2, 8], [2, 10], [2, 12], [3, 6],
  [3, 9], [3, 12], [4, 8], [4, 12], [5, 10], [6, 12],
]

const coprimePairs = [
  [2, 3], [2, 5], [2, 7], [2, 9], [3, 4], [3, 5],
  [3, 7], [3, 8], [3, 10], [4, 5], [4, 7], [4, 9],
  [5, 6], [5, 7], [5, 8], [5, 9], [6, 7], [7, 8],
  [7, 9], [8, 9],
]

const sharedFactorPairs = [
  [4, 6], [4, 10], [4, 14], [6, 8], [6, 9], [6, 10],
  [6, 14], [6, 15], [8, 10], [8, 12], [9, 12], [9, 15],
  [10, 12], [10, 15], [12, 15], [12, 14],
]

export const templates = [
  {
    id: 'm5.nf.add-fractions-unlike/multiple-denominators',
    skill: 'm5.nf.add-fractions-unlike',
    title: 'Friendly Denominators',
    difficulty: 1,
    widget: 'fraction',
    version: 1,
    generate: (rng) => makeProblem(rng, multiplePairs),
  },
  {
    id: 'm5.nf.add-fractions-unlike/coprime-denominators',
    skill: 'm5.nf.add-fractions-unlike',
    title: 'Different Denominators',
    difficulty: 2,
    widget: 'fraction',
    version: 1,
    generate: (rng) => makeProblem(rng, coprimePairs),
  },
  {
    id: 'm5.nf.add-fractions-unlike/shared-factor-denominators',
    skill: 'm5.nf.add-fractions-unlike',
    title: 'Tricky Denominators',
    difficulty: 3,
    widget: 'fraction',
    version: 1,
    generate: (rng) => makeProblem(rng, sharedFactorPairs),
  },
]
