# Grove Games — Design Plan

This document describes the randomization, difficulty, and Nora-integration plan for each game.
Current state is noted alongside the target state so implementation work is clearly scoped.

---

## 1. Sudoku

### Current state
Single hard-coded 4×4 mini-puzzle in `src/index.js` (`MINI_SUDOKU_PUZZLE`).
No difficulty levels. Reset just restores the same puzzle.

### Target state

#### Puzzle generation (pure client-side, no Nora needed)
A `generateSudoku(size, difficulty)` function lives in `src/sudoku.js`.

Algorithm:
1. Start with a valid solved board produced by backtracking fill.
2. Remove cells one at a time using a random order, checking after each removal that
   the puzzle still has exactly one solution (deterministic backtracking solver).
3. Stop removing cells when the clue-count target for the chosen difficulty is reached.

Grid sizes and clue counts:

| Difficulty | Grid  | Clues removed | Approx. clues left |
|------------|-------|---------------|--------------------|
| Easy       | 4×4   | 4–5           | 11–12              |
| Medium     | 6×6   | 12–15         | 21–24              |
| Hard       | 9×9   | 45–51         | 30–36              |
| Expert     | 9×9   | 52–58         | 23–29              |

#### UI changes (`src/ui/SudokuGame.js`)
- Difficulty selector shown before game start (Easy / Medium / Hard / Expert).
- "New Puzzle" button generates a fresh puzzle at the current difficulty.
- Valid placement range adapts to grid size (1-4, 1-6, or 1-9).
- 2×2 blocks for 4×4, 2×3 blocks for 6×6, 3×3 blocks for 9×9.
- Timer shown (optional, off by default).

#### State exported from `src/index.js`
`MINI_SUDOKU_PUZZLE` is kept for tests. New functions added:
```
generateSudokuPuzzle(size: 4|6|9, difficulty: 'easy'|'medium'|'hard'|'expert'): { board, solution }
```

---

## 2. Hangman

### Current state
5 hard-coded words in `HANGMAN_ROUNDS` in `src/index.js`.
`pickHangmanRound(seed)` picks by index — extremely small vocabulary.

### Target state

#### Local word bank expansion
Pre-built dictionary is now grouped by school level directly in `src/index.js` via `HANGMAN_DICTIONARY` and `HANGMAN_LEVELS`.

| Level         | Dictionary strategy |
|---------------|---------------------|
| Elementary    | Everyday concrete vocabulary |
| Middle School | Curriculum-adjacent general academic terms |
| High School   | Advanced STEM/humanities vocabulary |

`pickHangmanRound(level, seed?)` picks deterministically by seed for testability and randomly in UI play.

#### Nora integration — "New Word from Nora"
A "🪄 Ask Nora" button POSTs to `/api/nora-word` (Nora chat app, proxied through the Grove shell) with a short prompt:

```
Give me one hangman word in the category "{category}".
Respond with JSON: { "word": "ELEPHANT", "hint": "Largest land animal", "mascot": "🐘" }
```

The response is validated (word is a single uppercase alpha string 4–12 chars).
On failure the game silently falls back to a local bank word.
A loading spinner replaces the word display while the request is in flight.

#### Difficulty levels
| Level   | Max wrong guesses | Alphabet shown |
|---------|-------------------|----------------|
| Easy    | 9                 | Yes            |
| Normal  | 7 (current)       | Yes            |
| Hard    | 5                 | No             |

---

## 3. Word Scramble

### Current state
10 hard-coded word/hint pairs in `WORDBANK` inside the component.
Same bank is re-used across every session, so words repeat quickly.

### Target state

#### Local bank extraction
`src/wordbanks/scramble.js` exports at least 60 word/hint pairs, grouped by difficulty:

| Difficulty | Word length | Word count |
|------------|-------------|------------|
| Easy       | 4–5 letters | 20         |
| Medium     | 6–7 letters | 25         |
| Hard       | 8+ letters  | 15         |

`pickScrambleRound(difficulty, used)` picks a random word not already played this session.
A session set tracks played words and resets after exhaustion.

#### Nora integration — "New Words from Nora"
Before each 5-round game a call to Nora can pre-fetch 5 fresh words for a theme chosen by the user (e.g. "animals", "food", "tech"):

Prompt:
```
Give me 5 words for a word-scramble game on the theme "{theme}".
Respond with JSON array: [{ "word": "GIRAFFE", "hint": "Long necked animal" }, ...]
All words must be 4–10 uppercase letters, no spaces.
```

Words are validated and cached locally (sessionStorage).
Button label: "🪄 Nora's Theme Pack — enter a theme".
Fallback: local bank used if Nora is unavailable.

---

## 4. Crossword

### Current state
Crossword now has a level-based local puzzle bank in `src/index.js` for `elementary`, `middleschool`, and `highschool`.
The UI loads Nora-generated puzzles first and falls back to the local bank when generation or validation fails.

### Target state

#### Multiple local puzzles
`pickCrosswordPuzzle(level, seed?)` returns a deterministic level-appropriate local puzzle for tests and a random one in UI play.
`normalizeCrosswordPuzzle(...)` validates entries, dimensions, and crossing letters before a puzzle is accepted.

#### Nora integration — AI-generated crossword
A "🪄 Generate Crossword" button sends a prompt to Nora:

```
Create a mini crossword puzzle on the theme "{theme}" with exactly 4 words,
2 across and 2 down, intersecting at least once.
Respond as JSON matching this schema:
{
  "title": "...",
  "entries": [
    { "id": "1A", "clue": "...", "answer": "WORD", "row": 0, "col": 0, "direction": "across" },
    ...
  ]
}
All answers must be uppercase letters only, 4–9 characters.
```

The response is validated (no overlapping conflicts, all intersections match).
Invalid responses are rejected with a user-visible error and fallback to a local puzzle.

The games app now validates Nora output with `normalizeCrosswordPuzzle(...)` and rejects malformed or conflicting grids before rendering.

---

## 5. Math Lightning

### Current state
Already fully randomized — questions are generated from `Math.random()` each round.
4 difficulty levels already exist (Rookie / Pro / Expert / Lightning).

### Target state (incremental improvements only)

#### Expanded operations by difficulty
| Difficulty | Operations                         |
|------------|------------------------------------|
| Rookie     | multiplication, small addition      |
| Pro        | multiplication, addition, subtraction|
| Expert     | all four operations                 |
| Lightning  | all four, negative results allowed  |

Currently only multiplication is used. The generator in `generateQuestion` needs branching by `level` to pick an operation.

#### No Nora integration needed.

---

## 6. Logic Code (Mastermind)

### Current state
Already fully randomized — secret code is generated fresh each game from `Math.random()`.
Single difficulty: 4 pegs, 6 colors, 8 attempts.

### Target state (difficulty levels only)

| Difficulty | Code length | Colors available | Max attempts |
|------------|-------------|------------------|--------------|
| Easy       | 3           | 4                | 10           |
| Normal     | 4 (current) | 6                | 8            |
| Hard       | 5           | 6                | 7            |
| Expert     | 5           | 8                | 6            |

Difficulty selector shown on the idle/start screen.

#### No Nora integration needed.

---

## 7. Memory Match

### Current state
Already fully randomized — deck is shuffled with `Math.random()` each game.
Fixed 4×4 grid (8 pairs of 8 emoji).

### Target state (difficulty levels only)

| Difficulty | Grid  | Pairs | Emoji pool         |
|------------|-------|-------|--------------------|
| Easy       | 3×4   | 6     | animals            |
| Normal     | 4×4   | 8     | animals (current)  |
| Hard       | 4×6   | 12    | animals + food     |
| Expert     | 5×6   | 15    | animals + food + misc |

Multiple themed emoji sets in `src/wordbanks/memory.js`:
- Animals, Food, Faces, Sports, Weather, Space

"Pick a theme" option on the start screen.

#### No Nora integration needed.

---

## 8. Gomoku

### Current state
AI already runs via a Web Worker with MCTS.
AI config (`timeBudgetMs`, `maxPlayouts`, etc.) is hard-coded in the component.
Board is always 15×15 (Gomoku standard), win condition is 5 in a row.

### Target state (difficulty levels only)

| Difficulty | timeBudgetMs | maxPlayouts | maxRolloutDepth | candidateLimit |
|------------|-------------|-------------|-----------------|----------------|
| Easy       | 400          | 800         | 6               | 10             |
| Normal     | 1200         | 3500        | 10              | 18             |
| Hard       | 2200         | 9000        | 14              | 24 (current)   |
| Champion   | 4000         | 20000       | 18              | 32             |

Difficulty selector shown on a "new game" screen.
Config object passed to the worker message instead of being hard-coded.

---

## Nora API contract (shared for all word-game integrations)

All Nora calls go through a single thin proxy route added to the games app:

```
POST /api/nora-generate
Body: { type: 'hangman'|'scramble'|'crossword', theme: string, count?: number }
Response: { words?: [...], puzzle?: {...}, error?: string }
```

The route in `apps/games/app/api/nora-generate/route.js` POSTs to the Nora
orchestrator (`/api/chat`) with a constructed system prompt for each `type`,
parses the JSON from the assistant turn, validates the schema, and returns it.

A 5 second timeout is enforced. Any parse or timeout error returns `{ error: '...' }`.
The UI always treats this as a soft failure and falls back to the local bank.

---

## Implementation order

1. Sudoku generator (pure algorithm, no external deps)
2. Hangman + Word Scramble local bank expansion
3. Logic Code & Memory Match difficulty levels
4. Math Lightning operation expansion
5. Gomoku difficulty levels
6. `/api/nora-generate` route + Hangman Nora integration
7. Word Scramble Nora theme packs
8. Crossword multi-puzzle bank
9. Crossword Nora generation (feature-flagged)
