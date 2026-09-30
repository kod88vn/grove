import { getProblem, listProblems, render, toInstance } from '@grove/curriculum'

export const GALLERY_SEED = 2505

function coinCountsFor(total, denominations) {
  let remaining = total
  const counts = {}
  for (const coin of [...denominations].sort((left, right) => right - left)) {
    counts[coin] = Math.floor(remaining / coin)
    remaining %= coin
  }
  return counts
}

export function gallerySamples() {
  const seen = new Set()
  return listProblems()
    .filter((problem) => {
      if (seen.has(problem.widget)) return false
      seen.add(problem.widget)
      return true
    })
    .map((problem) => {
      const rendered = render(getProblem(problem.id), GALLERY_SEED)
      return {
        widget: rendered.widget,
        problemId: problem.id,
        title: problem.title,
        instance: toInstance(rendered),
        answer: rendered.answer,
        explanation: rendered.explanation,
      }
    })
}

export function correctValueFor(sample) {
  if (sample.widget === 'number' || sample.widget === 'column') return String(sample.answer.value)
  if (sample.widget === 'fraction') return `${sample.answer.num}/${sample.answer.den}`
  if (sample.widget === 'fraction-bar') {
    return Array.from({ length: sample.answer.num * sample.instance.visual.segments / sample.answer.den }, (_, index) => index)
  }
  if (sample.widget === 'cloze') {
    return sample.answer.blanks.map((blank) => {
      const choice = sample.instance.visual.choices.find((entry) => blank.accept.some((accepted) => normalize(entry) === normalize(accepted)))
      if (choice === undefined) throw new Error(`no accepted choice for ${sample.widget}`)
      return choice
    })
  }
  if (sample.widget === 'choice') {
    const option = sample.instance.visual.options.find((entry) => entry.id === sample.answer.id)
    if (option === undefined) throw new Error(`no correct choice for ${sample.widget}`)
    return option.id
  }
  if (sample.widget === 'order') return [...sample.answer.sequence]
  if (sample.widget === 'sort') {
    const value = sample.instance.visual.items.map(() => null)
    for (const [bucketId, ids] of Object.entries(sample.answer.buckets)) {
      for (const id of ids) value[sample.instance.visual.items.findIndex((item) => item.id === id)] = bucketId
    }
    return value
  }
  if (sample.widget === 'match') {
    return sample.instance.visual.right.map((card) => {
      const pair = sample.answer.pairs.find((entry) => entry.right === card.id)
      if (pair === undefined) throw new Error(`no correct match for ${card.id}`)
      return pair.left
    })
  }
  if (sample.widget === 'clock') return [sample.answer.hour, sample.answer.minute]
  if (sample.widget === 'coins') return coinCountsFor(sample.answer.total, sample.answer.denominations)
  if (sample.widget === 'tap-select') return [...sample.answer.ids]
  throw new Error(`unknown widget: ${sample.widget}`)
}

export function wrongValueFor(sample) {
  if (sample.widget === 'number' || sample.widget === 'column') {
    const offset = Math.max(1, (sample.answer.tolerance ?? 0) + 1)
    return String(sample.answer.value + offset)
  }
  if (sample.widget === 'fraction') return `${sample.answer.num + 1}/1`
  if (sample.widget === 'fraction-bar') {
    const count = sample.answer.num * sample.instance.visual.segments / sample.answer.den
    return Array.from({ length: count + 1 }, (_, index) => index)
  }
  if (sample.widget === 'cloze') {
    return sample.answer.blanks.map((blank) => {
      const choice = sample.instance.visual.choices.find((entry) => !blank.accept.some((accepted) => normalize(entry) === normalize(accepted)))
      if (choice === undefined) throw new Error(`no wrong choice for ${sample.widget}`)
      return choice
    })
  }
  if (sample.widget === 'choice') {
    const option = sample.instance.visual.options.find((entry) => entry.id !== sample.answer.id)
    if (option === undefined) throw new Error(`no wrong choice for ${sample.widget}`)
    return option.id
  }
  if (sample.widget === 'order') return [...sample.answer.sequence].reverse()
  if (sample.widget === 'sort') {
    const value = correctValueFor(sample)
    const [firstBucket, secondBucket] = sample.instance.visual.buckets.map((bucket) => bucket.id)
    const first = value.findIndex((bucketId) => bucketId === firstBucket)
    const second = value.findIndex((bucketId) => bucketId === secondBucket)
    if (first < 0 || second < 0) throw new Error(`no wrong value for ${sample.widget}`)
    value[first] = secondBucket
    value[second] = firstBucket
    return value
  }
  if (sample.widget === 'match') {
    const value = correctValueFor(sample)
    return value.map((leftId) => {
      const index = sample.instance.visual.left.findIndex((item) => item.id === leftId)
      if (index < 0) throw new Error(`no wrong match for ${leftId}`)
      return sample.instance.visual.left[(index + 1) % sample.instance.visual.left.length].id
    })
  }
  if (sample.widget === 'clock') return [sample.answer.hour, (sample.answer.minute + 5) % 60]
  if (sample.widget === 'coins') {
    const counts = coinCountsFor(sample.answer.total, sample.answer.denominations)
    const smallest = Math.min(...sample.answer.denominations)
    counts[smallest] += 1
    return counts
  }
  if (sample.widget === 'tap-select') {
    const distractor = sample.instance.visual.tokens.find((token) => !sample.answer.ids.includes(token.id))
    if (distractor === undefined) throw new Error(`no wrong token for ${sample.widget}`)
    return [sample.answer.ids[0], distractor.id]
  }
  throw new Error(`unknown widget: ${sample.widget}`)
}

const normalize = (text) => text.trim().replace(/\s+/g, ' ').toLowerCase()

export const MATH_SAMPLE = {
  latex: 'x^2 + \\sqrt{y} + \\pi',
  caption: 'Exponent, square root, and pi notation.',
}
