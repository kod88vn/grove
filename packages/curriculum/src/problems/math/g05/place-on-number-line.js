import { equivalentFractions } from './shade-equivalent.js'

export const templates = [{
  id: 'm5.nf.equiv-fractions/place-on-number-line',
  skill: 'm5.nf.equiv-fractions',
  title: 'Place an Equivalent Fraction on a Number Line',
  difficulty: 1,
  widget: 'number-line',
  version: 1,
  generate: (rng) => {
    const { num, den, multiplier } = rng.pick(equivalentFractions)
    const segments = den * multiplier
    return {
      prompt: `Mark the point on the number line that represents a fraction equivalent to ${num}/${den}.`,
      visual: { kind: 'number-line', segments },
      answer: { num, den, simplest: false },
      hints: ['Multiply the numerator and denominator by the same number.', 'Use the equivalent fraction to find the tick.'],
      explanation: `${num}/${den} is equivalent to ${num * multiplier}/${segments}.`,
    }
  },
}]
