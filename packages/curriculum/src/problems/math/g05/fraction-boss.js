// Fraction Forest boss (HOMEWORK_PLAN.md §4: paths end in a 👑 boss problem).
// A three-step quest that chains the whole fraction strand: build the common
// denominator, write the sum, then simplify. Multi-step on purpose — a boss
// must combine what the path taught, not repeat a single move.
function gcd(a, b) {
  while (b) {
    const rest = a % b
    a = b
    b = rest
  }
  return a
}

function fraction(numerator, denominator) {
  const sign = numerator === 0 ? 1 : (numerator < 0) !== (denominator < 0) ? -1 : 1
  const absolute = sign * Math.abs(numerator)
  const factor = gcd(Math.abs(numerator), Math.abs(denominator))
  const reduced = Math.abs(numerator) / factor
  const reducedDenominator = Math.abs(denominator) / factor
  if (reduced === 0) return '0'
  if (reducedDenominator === 1) return `${sign * reduced}`
  return `${sign < 0 ? '-' : ''}${reduced}/${reducedDenominator}`
}

function generateFractionBoss(rng) {
  const denominators = [4, 6, 8, 9, 10, 12]
  let a = rng.pick(denominators)
  let b = rng.pick(denominators)
  let guard = 0
  while (a === b && guard < 12) {
    b = rng.pick(denominators)
    guard += 1
  }
  const factor = gcd(a, b)
  const common = (a / factor) * b
  const numeratorA = rng.int(1, a - 1)
  const numeratorB = rng.int(1, b - 1)
  const scaledA = (numeratorA * common) / a
  const scaledB = (numeratorB * common) / b
  const sumNumerator = scaledA + scaledB
  const first = `${numeratorA}/${a}`
  const second = `${numeratorB}/${b}`
  return {
    prompt: `👑 Boss quest: find the sum of ${first} + ${second}. Work it in three steps.`,
    visual: {
      kind: 'steps',
      items: [
        { id: 'step-1', label: 'Step 1: write the first fraction with the common denominator' },
        { id: 'step-2', label: 'Step 2: write the two fractions added over that common denominator' },
        { id: 'step-3', label: 'Step 3: write the final sum, simplified' },
      ],
    },
    answer: {
      steps: [
        { grammar: 'rational', expression: fraction(scaledA, common) },
        { grammar: 'rational', expression: `${fraction(scaledA, common)} + ${fraction(scaledB, common)}` },
        { grammar: 'rational', expression: fraction(sumNumerator, common) },
      ],
    },
    hints: [
      `The common denominator is a number both ${a} and ${b} divide into evenly.`,
      'Scale the second fraction the same way, then add the numerators.',
      'Divide the top and bottom of the final fraction by their greatest common factor.',
    ],
    explanation: `${first} = ${fraction(scaledA, common)} and ${second} = ${fraction(scaledB, common)}, so the sum is ${fraction(sumNumerator, common)}.`,
  }
}

export const templates = [{
  id: 'm5.nf.add-fractions-unlike/fraction-boss',
  skill: 'm5.nf.add-fractions-unlike',
  title: 'Boss: Sum of Fractions in Three Steps',
  difficulty: 3,
  widget: 'steps',
  version: 1,
  generate: generateFractionBoss,
}]
