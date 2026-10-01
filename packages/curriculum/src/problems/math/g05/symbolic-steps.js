const generateStepsProblem = (rng) => {
  const left = rng.int(2, 20)
  const right = rng.int(2, 20)
  const multiplier = rng.int(2, 9)
  const sum = left + right
  return {
    prompt: `Simplify the parentheses first, then write the multiplication for (${left} + ${right}) × ${multiplier}.`,
    visual: {
      kind: 'steps',
      items: [
        { id: 'step-1', label: 'Step 1' },
        { id: 'step-2', label: 'Step 2' },
      ],
    },
    answer: {
      steps: [
        { grammar: 'polynomial', expression: String(sum) },
        { grammar: 'polynomial', expression: `${sum}*${multiplier}` },
      ],
    },
    hints: ['Add the two numbers inside the parentheses first.', 'Use that sum as the first factor in the multiplication.'],
    explanation: `First ${left} + ${right} = ${sum}; then multiply ${sum} by ${multiplier}.`,
  }
}

export const templates = [{
  id: 'm5.oa.order-of-operations/ordered-parentheses-steps',
  skill: 'm5.oa.order-of-operations',
  title: 'Parentheses in Ordered Steps',
  difficulty: 2,
  widget: 'steps',
  version: 1,
  generate: generateStepsProblem,
}]
