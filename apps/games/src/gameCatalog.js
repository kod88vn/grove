import { GAME_SLUGS } from './index.js'

export const GAME_META = {
  crossword: { label: 'Crossword', emoji: '📰', title: 'Crossword', summary: 'Solve a playful mini crossword together.' },
  hangman: { label: 'Hangman', emoji: '🎯', title: 'Hangman', summary: 'Guess the word before the drawing is complete.' },
  sudoku: { label: 'Sudoku', emoji: '🔢', title: 'Sudoku', summary: 'Fill the board using logic and number patterns.' },
  gomoku: { label: 'Gomoku', emoji: '⚫', title: 'Gomoku', summary: 'Get five in a row before Nora does.' },
  'math-lightning': { label: 'Math Lightning', emoji: '⚡', title: 'Math Lightning', summary: 'Fast arithmetic rounds for quick practice.' },
  'word-scramble': { label: 'Word Scramble', emoji: '🔤', title: 'Word Scramble', summary: 'Unscramble mixed-up words against the clock.' },
  'memory-match': { label: 'Memory Match', emoji: '🃏', title: 'Memory Match', summary: 'Flip cards and find all the matching pairs.' },
  'logic-code': { label: 'Tile Match', emoji: '🎯', title: 'Tile Match', summary: 'Connect matching tiles with a direct line.' },
}

export function getGameModule(slug) {
  if (!GAME_SLUGS.includes(slug)) return null

  const meta = GAME_META[slug]
  return {
    slug,
    title: meta.title,
    summary: meta.summary,
    label: meta.label,
    emoji: meta.emoji,
  }
}