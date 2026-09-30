const DENOMINATIONS = [1, 5, 10, 25]

const makeProblem = (rng) => {
  const total = rng.int(1, 99)
  return {
    prompt: `Use the coins to make ${total}¢. Add coins until their value matches the target.`,
    visual: { kind: 'coins', target: total, denominations: [...DENOMINATIONS] },
    answer: { total, denominations: [...DENOMINATIONS] },
    hints: [
      'A quarter is worth 25¢. See how many quarters fit without going over the target.',
      'After quarters, use dimes, then nickels, and pennies for the remaining cents.',
    ],
    explanation: `The coins add to ${total}¢. Start with quarters, then use dimes, nickels, and pennies to make the remaining value.`,
  }
}

export const templates = [{
  id: 'm5.md.time-money/coins-value',
  skill: 'm5.md.time-money',
  title: 'Make a Value with Coins',
  widget: 'coins',
  version: 1,
  difficulty: 2,
  generate: makeProblem,
}]
