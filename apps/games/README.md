# Games

Source-of-truth workspace for Grove educational games.

This package now owns both the shared rules/helpers and the game UI source that was previously embedded inside Nora.

Current layout:

- `src/index.js` — shared game rules and helpers
- `src/ModuleGameArcade.js` — top-level arcade renderer source
- `src/ui/` — individual game UI modules and arcade effects

## Gomoku

Gomoku is an AI-powered strategy game with the following features:

- **Symbol Selection**: Players choose their animal symbol at game start from 10 available options (Fox, Panda, Bunny, Lion, Tiger, Bear, Wolf, Eagle, Turtle, Cricket)
- **Auto AI Assignment**: The AI automatically selects a different random symbol to avoid conflicts
- **Difficulty Progression**: 
  - Starts at **Intermediate** level using MCTS (Monte Carlo Tree Search)
  - Automatically upgrades to **Expert** level after the player beats the AI once
  - Expert level uses an adaptive reward-based algorithm that scores moves on connection potential, open-ended threats, and future extension possibilities
  - AI defends strategically: blocks user's 3-in-a-row open-ended and 4-in-a-row with 1 blocked side
- **Series Play**: Track wins across multiple rounds with the "Series Score" display
- **Infinity Board**: Dynamic board that adjusts to the game state with a max distance of 3 cells from existing stones for legal moves
- **Visual AI Level Indicator**: Shows current AI difficulty ("⚡ Intermediate" or "🏆 Expert") at the bottom of the game

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
```
