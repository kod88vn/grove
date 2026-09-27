const makeProblem = (top, bottom) => {
  const digits = String(top).split('').map(Number)
  const parts = digits
    .map((digit, index) => digit * 10 ** (digits.length - 1 - index))
    .filter((part) => part !== 0)
  const partials = parts.map((part) => part * bottom)
  const product = top * bottom
  const partText = parts.length === 2
    ? `${parts[0]} and ${parts[1]}`
    : `${parts[0]}, ${parts[1]} and ${parts[2]}`
  const explanationText = partials.length === 2
    ? `${parts[0]} × ${bottom} = ${partials[0]} and ${parts[1]} × ${bottom} = ${partials[1]}`
    : `${parts[0]} × ${bottom} = ${partials[0]}, ${parts[1]} × ${bottom} = ${partials[1]} and ${parts[2]} × ${bottom} = ${partials[2]}`
  const partialSum = partials.join(' + ')

  return {
    prompt: `Multiply: ${top} × ${bottom}`,
    visual: { kind: 'column', operator: '×', operands: [top, bottom], parts, partials },
    answer: { value: product },
    hints: [
      `Split ${top} into ${partText}.`,
      `Multiply each part by ${bottom}, then add the partial products.`,
    ],
    explanation: `${explanationText}, and ${partialSum} = ${product}.`,
  }
}

const makeTwoByOne = (rng) => {
  let top = rng.int(10, 99)
  while (String(top).includes('0')) top = rng.int(10, 99)
  return makeProblem(top, rng.int(2, 9))
}

const makeTwoByTwo = (rng) => {
  let top = rng.int(10, 99)
  while (String(top).includes('0')) top = rng.int(10, 99)
  let bottom = rng.int(10, 99)
  while (String(bottom).includes('0')) bottom = rng.int(10, 99)
  return makeProblem(top, bottom)
}

const makeThreeByTwo = (rng) => {
  let top = rng.int(100, 999)
  while (String(top).includes('0')) top = rng.int(100, 999)
  let bottom = rng.int(10, 99)
  while (String(bottom).includes('0')) bottom = rng.int(10, 99)
  return makeProblem(top, bottom)
}

export const templates = [
  {
    id: 'm5.nbt.long-multiplication/two-by-one',
    skill: 'm5.nbt.long-multiplication',
    title: 'Two by One',
    difficulty: 1,
    widget: 'column',
    version: 1,
    generate: makeTwoByOne,
  },
  {
    id: 'm5.nbt.long-multiplication/two-by-two',
    skill: 'm5.nbt.long-multiplication',
    title: 'Two by Two',
    difficulty: 2,
    widget: 'column',
    version: 1,
    generate: makeTwoByTwo,
  },
  {
    id: 'm5.nbt.long-multiplication/three-by-two',
    skill: 'm5.nbt.long-multiplication',
    title: 'Three by Two',
    difficulty: 3,
    widget: 'column',
    version: 1,
    generate: makeThreeByTwo,
  },
]
