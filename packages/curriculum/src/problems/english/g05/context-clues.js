import { items } from '../../../content/english/items/g05/context-clues.js'

const easyItems = items.filter((item) => item.difficulty === 1)
const mediumItems = items.filter((item) => item.difficulty === 2)
const hardItems = items.filter((item) => item.difficulty === 3)

const makeProblem = (rng, candidates) => {
  const item = rng.pick(candidates)

  return {
    prompt: 'Read the sentence and choose the word that best fits the blank.',
    visual: {
      kind: 'cloze',
      sentence: item.sentence,
      choices: rng.shuffle(item.choices),
    },
    answer: { blanks: [{ accept: [item.answer] }] },
    hints: item.hints,
    explanation: item.explanation,
  }
}

export const templates = [
  {
    id: 'e5.l.context-clues/easy-words',
    skill: 'e5.l.context-clues',
    title: 'Helpful Clues',
    difficulty: 1,
    widget: 'cloze',
    version: 1,
    generate: (rng) => makeProblem(rng, easyItems),
  },
  {
    id: 'e5.l.context-clues/strong-clues',
    skill: 'e5.l.context-clues',
    title: 'Context Clues',
    difficulty: 2,
    widget: 'cloze',
    version: 1,
    generate: (rng) => makeProblem(rng, mediumItems),
  },
  {
    id: 'e5.l.context-clues/tricky-clues',
    skill: 'e5.l.context-clues',
    title: 'Tricky Clues',
    difficulty: 3,
    widget: 'cloze',
    version: 1,
    generate: (rng) => makeProblem(rng, hardItems),
  },
]
