const makeWorking = (expression, intermediateSteps, answer, prompt, hints) => {
  const steps = [expression, ...intermediateSteps, String(answer)]
  return {
    prompt,
    visual: { kind: 'expression', expression, steps },
    answer: { value: answer },
    hints,
    explanation: `Follow the order of operations: ${steps.join(' = ')}.`,
  }
}

const makeDifficultyOne = (rng) => {
  while (true) {
    const operator = rng.pick(['+', '-'])
    const c = rng.int(2, 20)
    const b = operator === '-'
      ? c <= 9 ? rng.int(2, Math.floor(18 / c)) : null
      : rng.int(2, 4)
    if (b === null) continue
    const a = operator === '-'
      ? rng.int(b * c + 2, 20)
      : rng.int(2, 20)
    const product = b * c
    const answer = operator === '+' ? a + product : a - product
    const expression = `${a} ${operator} ${b} × ${c}`
    if ([a, b, c].includes(answer) || answer > 1000) continue
    return makeWorking(
      expression,
      [`${a} ${operator} ${product}`],
      answer,
      `Work out: ${expression}`,
      [
        `Multiply ${b} × ${c} before you ${operator === '+' ? 'add' : 'subtract'}.`,
        'Use × and ÷ before + and -; work from left to right when operators match.',
      ],
    )
  }
}

const makeDifficultyTwo = (rng) => {
  while (true) {
    const operator = rng.pick(['+', '-'])
    const a = operator === '-' ? rng.int(4, 20) : rng.int(2, 20)
    const b = operator === '-' ? rng.int(2, a - 2) : rng.int(2, 20)
    const c = rng.int(2, 20)
    const inside = operator === '+' ? a + b : a - b
    const answer = inside * c
    const expression = `(${a} ${operator} ${b}) × ${c}`
    if ([a, b, c].includes(answer) || answer > 1000) continue
    const first = `${inside} × ${c}`
    return makeWorking(
      expression,
      [first],
      answer,
      `Work out: ${expression}`,
      [
        `Start inside the brackets: ${a} ${operator} ${b}.`,
        'Brackets first, then × and ÷ from left to right, then + and -.',
      ],
    )
  }
}

const makeDifficultyThree = (rng) => {
  while (true) {
    const a = rng.int(2, 20)
    const b = rng.int(2, 20)
    const multiplier = rng.int(2, 20)
    const product = (a + b) * multiplier
    const divisors = Array.from({ length: 19 }, (_, index) => index + 2)
      .filter((divisor) => product % divisor === 0 && product / divisor >= 2)
    if (divisors.length === 0) continue
    const divisor = rng.pick(divisors)
    const answer = product / divisor
    const expression = `(${a} + ${b}) × ${multiplier} ÷ ${divisor}`
    if ([a, b, multiplier, divisor].includes(answer) || multiplier === divisor) continue
    const first = `${a + b} × ${multiplier} ÷ ${divisor}`
    const second = `${product} ÷ ${divisor}`
    return makeWorking(
      expression,
      [first, second],
      answer,
      `Work out: ${expression}`,
      [
        `Start inside the brackets: ${a} + ${b}.`,
        'Brackets first, then × and ÷ from left to right, then + and -.',
      ],
    )
  }
}

export const templates = [
  {
    id: 'm5.oa.order-of-operations/precedence',
    skill: 'm5.oa.order-of-operations',
    title: 'Operation Order',
    difficulty: 1,
    widget: 'number',
    version: 1,
    generate: makeDifficultyOne,
  },
  {
    id: 'm5.oa.order-of-operations/brackets',
    skill: 'm5.oa.order-of-operations',
    title: 'Bracket Power',
    difficulty: 2,
    widget: 'number',
    version: 1,
    generate: makeDifficultyTwo,
  },
  {
    id: 'm5.oa.order-of-operations/exact-division',
    skill: 'm5.oa.order-of-operations',
    title: 'Exact Steps',
    difficulty: 3,
    widget: 'number',
    version: 1,
    generate: makeDifficultyThree,
  },
]
