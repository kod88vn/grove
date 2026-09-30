import { items } from '../../../content/english/items/g05/context-clues.js'

function wordSpans(text) {
  return Array.from(text.matchAll(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu), (match) => ({
    label: match[0],
    start: match.index,
    end: match.index + match[0].length,
  }))
}

function blankSpan(sentence) {
  const start = sentence.indexOf('____')
  if (start < 0) throw new TypeError('context clue sentence must contain a blank')
  return { start, end: start + 4 }
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

function makeProblem(rng, candidates) {
  const item = rng.pick(candidates)
  const spans = wordSpans(item.sentence)
  const labels = spans.map(({ label }) => label)
  const clueWords = wordSpans(item.clue).map(({ label }) => label)
  const cluePositions = new Set(clueIndexes(labels, clueWords))
  const opaqueIds = rng.shuffle(labels.map((_, index) => `token-${index.toString(36)}`))
  const tokens = labels.map((label, index) => ({ id: opaqueIds[index], label }))
  const blank = blankSpan(item.sentence)
  const events = [
    ...spans.map((span, index) => ({ ...span, kind: 'word', id: tokens[index].id })),
    { ...blank, kind: 'blank' },
  ].sort((left, right) => left.start - right.start)
  const segments = []
  let cursor = 0
  for (const event of events) {
    if (event.start > cursor) segments.push({ kind: 'text', text: item.sentence.slice(cursor, event.start) })
    segments.push(event.kind === 'word' ? { kind: 'word', id: event.id } : { kind: 'blank' })
    cursor = event.end
  }
  if (cursor < item.sentence.length) segments.push({ kind: 'text', text: item.sentence.slice(cursor) })

  return {
    prompt: 'Tap the words in the sentence that help explain the missing word.',
    visual: { kind: 'tap-select', tokens, segments, blankIndex: events.filter((event) => event.kind === 'word' && event.end <= blank.start).length },
    answer: {
      ids: labels.flatMap((_, index) => cluePositions.has(index) ? [tokens[index].id] : []),
      availableIds: tokens.map((token) => token.id),
    },
    hints: ['Read the whole sentence and notice which details help explain the missing word.'],
    explanation: 'The selected words are evidence that helps explain the missing word.',
  }
}

export const templates = [
  {
    id: 'e5.l.context-clues/find-the-clue-easy',
    skill: 'e5.l.context-clues',
    title: 'Find the Clue',
    difficulty: 1,
    widget: 'tap-select',
    version: 1,
    generate: (rng) => makeProblem(rng, items.filter((item) => item.difficulty === 1)),
  },
  {
    id: 'e5.l.context-clues/find-the-clue',
    skill: 'e5.l.context-clues',
    title: 'Find the Clue',
    difficulty: 2,
    widget: 'tap-select',
    version: 1,
    generate: (rng) => makeProblem(rng, items.filter((item) => item.difficulty === 2)),
  },
  {
    id: 'e5.l.context-clues/find-the-clue-tricky',
    skill: 'e5.l.context-clues',
    title: 'Find the Clue',
    difficulty: 3,
    widget: 'tap-select',
    version: 1,
    generate: (rng) => makeProblem(rng, items.filter((item) => item.difficulty === 3)),
  },
]
