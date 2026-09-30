import { items } from '../../../content/english/items/g05/context-clues.js'

function words(text) {
  return text.split(/\s+/).flatMap((word) => {
    if (word.includes('____')) return []
    return word.match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu) ?? []
  })
}

function blankIndex(sentence) {
  const blankPosition = sentence.split(/\s+/).findIndex((word) => word.includes('____'))
  if (blankPosition < 0) throw new TypeError('context clue sentence must contain a blank')
  return words(sentence.split(/\s+/).slice(0, blankPosition).join(' ')).length
}

function clueIndexes(sentenceWords, clueWords) {
  const starts = sentenceWords.flatMap((word, index) => (
    clueWords.every((clueWord, offset) => sentenceWords[index + offset]?.toLowerCase() === clueWord.toLowerCase())
      ? [index]
      : []
  ))
  if (starts.length !== 1) throw new TypeError('context clue must appear exactly once as consecutive words')
  return Array.from({ length: clueWords.length }, (_, offset) => starts[0] + offset)
}

function makeProblem(rng) {
  const item = rng.pick(items)
  const labels = words(item.sentence)
  const clueWords = words(item.clue)
  const cluePositions = new Set(clueIndexes(labels, clueWords))
  const opaqueIds = rng.shuffle(labels.map((_, index) => `token-${index.toString(36)}`))
  const sentenceTokens = labels.map((label, index) => ({ id: opaqueIds[index], label }))
  const tokens = sentenceTokens

  return {
    prompt: 'Tap the words in the sentence that help explain the missing word.',
    visual: { kind: 'tap-select', tokens, blankIndex: blankIndex(item.sentence) },
    answer: {
      ids: labels.flatMap((_, index) => cluePositions.has(index) ? [sentenceTokens[index].id] : []),
      availableIds: tokens.map((token) => token.id),
    },
    hints: ['Read the whole sentence and notice which details help explain the missing word.'],
    explanation: 'The selected words are evidence that helps explain the missing word.',
  }
}

export const templates = [
  {
    id: 'e5.l.context-clues/find-the-clue',
    skill: 'e5.l.context-clues',
    title: 'Find the Clue',
    difficulty: 2,
    widget: 'tap-select',
    version: 1,
    generate: makeProblem,
  },
]
