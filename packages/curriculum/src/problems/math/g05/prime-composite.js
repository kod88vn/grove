const isPrime = (number) => {
  for (let divisor = 2; divisor * divisor <= number; divisor++) {
    if (number % divisor === 0) return false
  }
  return true
}

const factorPair = (number) => {
  for (let factor = 2; factor * factor <= number; factor++) {
    if (number % factor === 0) return [factor, number / factor]
  }
  return null
}

const numbers = [
  2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71,
  9, 15, 21, 25, 27, 33, 35, 39, 45, 49, 51, 55, 57, 63, 65, 69, 75, 81, 85, 91,
]

const makeProblem = (rng) => {
  const number = rng.pick(numbers)
  const prime = isPrime(number)
  const answer = prime ? 'prime' : 'composite'
  const options = rng.shuffle([
    { id: 'prime', label: 'Prime' },
    { id: 'composite', label: 'Composite' },
  ])
  const pair = factorPair(number)

  return {
    prompt: `Is ${number} prime or composite?`,
    visual: { kind: 'choice', options },
    answer: { id: answer },
    hints: [
      'Look for factors: numbers that multiply together to make the number.',
      'A prime number has exactly two factors: 1 and itself.',
    ],
    explanation: prime
      ? `${number} is prime because its only factors are 1 and ${number}.`
      : `${number} is composite because ${pair[0]} × ${pair[1]} = ${number}.`,
  }
}

export const templates = [
  {
    id: 'm5.oa.prime-composite/prime-or-composite',
    skill: 'm5.oa.prime-composite',
    title: 'Prime or Composite',
    difficulty: 1,
    widget: 'choice',
    version: 1,
    generate: makeProblem,
  },
]
