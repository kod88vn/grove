// Expression Express boss: substitute, simplify, then evaluate — the full
// variables-and-expressions strand in one multi-step quest.
function generateExpressionBoss(rng) {
  const x = rng.int(2, 9)
  const y = rng.int(2, 9)
  const z = rng.int(2, 9)
  const sum = x + y
  const product = sum * z
  return {
    prompt: `👑 Boss quest: evaluate (x + y) × z when x = ${x} and y = ${y} and z = ${z}. Show each step.`,
    visual: {
      kind: 'steps',
      items: [
        { id: 'step-1', label: 'Step 1: find x + y' },
        { id: 'step-2', label: 'Step 2: multiply that by z' },
        { id: 'step-3', label: 'Step 3: write the final value' },
      ],
    },
    answer: {
      steps: [
        { grammar: 'polynomial', expression: `${x} + ${y}` },
        { grammar: 'polynomial', expression: `${sum} * ${z}` },
        { grammar: 'polynomial', expression: String(product) },
      ],
    },
    hints: [
      'Replace x and y with their values first.',
      'Add inside the parentheses before you multiply.',
      'The final value is the number you end with.',
    ],
    explanation: `x + y = ${sum}, then ${sum} × ${z} = ${product}.`,
  }
}

export const templates = [{
  id: 'm5.oa.variables/expression-boss',
  skill: 'm5.oa.variables',
  title: 'Boss: Evaluate (x + y) × z',
  difficulty: 3,
  widget: 'steps',
  version: 1,
  boss: true,
  generate: generateExpressionBoss,
}]
