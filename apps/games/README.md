# Games

Source-of-truth workspace for Grove educational games.

This package now owns both the shared rules/helpers and the game UI source that was previously embedded inside Nora.

Current layout:

- `src/index.js` — shared game rules and helpers
- `src/ModuleGameArcade.js` — top-level arcade renderer source
- `src/ui/` — individual game UI modules and arcade effects

## Gomoku

AI-powered strategy game with symbol selection, series scoring, and progressive difficulty unlock. The AI runs in a Web Worker using minimax with alpha-beta pruning. See [GAME_DESIGN.md](GAME_DESIGN.md) for full AI architecture details.

## Crossword

Crossword now mirrors Hangman's loading model:

- `elementary`, `middleschool`, and `highschool` level buttons
- Nora-first puzzle generation through `app/api/nora-crossword/route.js`
- Automatic fallback to the local level-appropriate puzzle bank in `src/index.js`
- Shared puzzle normalization/validation before any puzzle reaches the UI

## Math Lightning

Math Lightning now uses dynamic progression:

- Every run starts at `Rookie`
- Correct answers before timeout level you up (more reward, less time)
- Wrong/timeout answers level you down
- Level selection is automatic (no pre-pick screen)

## Tests

```bash
yarn workspace @grove/games test