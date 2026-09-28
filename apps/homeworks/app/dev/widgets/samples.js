import { getProblem, listProblems, render, toInstance } from '@grove/curriculum'

export const GALLERY_SEED = 2505

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
  if (sample.widget === 'cloze') {
    return sample.answer.blanks.map((blank) => {
      const choice = sample.instance.visual.choices.find((entry) => blank.accept.some((accepted) => normalize(entry) === normalize(accepted)))
      if (choice === undefined) throw new Error(`no accepted choice for ${sample.widget}`)
      return choice
    })
  }
  throw new Error(`unknown widget: ${sample.widget}`)
}

export function wrongValueFor(sample) {
  if (sample.widget === 'number' || sample.widget === 'column') {
    const offset = Math.max(1, (sample.answer.tolerance ?? 0) + 1)
    return String(sample.answer.value + offset)
  }
  if (sample.widget === 'fraction') return `${sample.answer.num + 1}/1`
  if (sample.widget === 'cloze') {
    return sample.answer.blanks.map((blank) => {
      const choice = sample.instance.visual.choices.find((entry) => !blank.accept.some((accepted) => normalize(entry) === normalize(accepted)))
      if (choice === undefined) throw new Error(`no wrong choice for ${sample.widget}`)
      return choice
    })
  }
  throw new Error(`unknown widget: ${sample.widget}`)
}

const normalize = (text) => text.trim().replace(/\s+/g, ' ').toLowerCase()

export const MATH_SAMPLE = {
  latex: 'x^2 + \\sqrt{y} + \\pi',
  caption: 'Exponent, square root, and pi notation.',
}
