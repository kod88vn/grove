const generateFactorProblem = (rng) => {
  const factor = rng.int(2, 30)
  const square = factor * factor
  return {
    prompt: `Factor the difference of squares: x^2 - ${square}.`,
    visual: { kind: 'expression', expression: `x^2 - ${square}` },
    answer: {
      grammar: 'polynomial',
      expression: `(x-${factor})*(x+${factor})`,
      form: 'factored',
    },
    hints: ['Look for a difference of two squares.', 'Write it as one factor below and one factor above x.'],
    explanation: `The difference of squares factors as (x - ${factor})(x + ${factor}).`,
  }
}

// This follows the existing Grade 5 variables progression, which is deliberately untagged
// because polynomial factoring has no claimed Grade 5 CCSS alignment in the catalog.
export const templates = [{
  id: 'm5.oa.variables/factor-difference-of-squares',
  skill: 'm5.oa.variables',
  title: 'Factor a Difference of Squares',
  difficulty: 2,
  widget: 'expression',
  version: 1,
  generate: generateFactorProblem,
}]
