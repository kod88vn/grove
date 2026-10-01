const gcd = (a, b) => {
  let left = a
  let right = b
  while (right !== 0) [left, right] = [right, left % right]
  return left
}

export const equivalentFractions = []
for (let den = 2; den <= 6; den++) {
  for (let num = 1; num < den; num++) {
    if (gcd(num, den) !== 1) continue
    for (let multiplier = 2; multiplier <= 4 && den * multiplier <= 12; multiplier++) {
      equivalentFractions.push({ num, den, multiplier })
    }
  }
}

export const templates = [{
  id: 'm5.nf.equiv-fractions/shade-equivalent',
  skill: 'm5.nf.equiv-fractions',
  title: 'Shade an Equivalent Fraction',
  difficulty: 1,
  widget: 'fraction-bar',
  version: 1,
  generate: (rng) => {
    const { num, den, multiplier } = rng.pick(equivalentFractions)
    const segments = den * multiplier
    return {
      prompt: `The answer bar has ${segments} equal parts. Shade some of them to show a fraction equivalent to ${num}/${den}.`,
      visual: { kind: 'fraction-bar', reference: { num, den }, segments },
      answer: { num, den, simplest: false },
      hints: ['Multiply the numerator and denominator by the same number.', 'Shade the matching number of equal parts in the answer bar.'],
      explanation: `${num}/${den} is equivalent to ${num * multiplier}/${segments}.`,
    }
  },
}]
