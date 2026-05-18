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
- **Series Play**: Track wins across multiple rounds with the "Series Score" display
- **Infinity Board**: Dynamic board that adjusts to the game state with a max distance of 3 cells from existing stones for legal moves

### AI Difficulty Levels

The Gomoku AI uses a pattern-matching minimax engine with alpha-beta pruning. Four difficulty levels are available:

| Level | Search Depth | Error Rate | Key Features |
|-------|-------------|------------|--------------|
| 🌱 Beginner | 2 (heuristic only) | 30% | Basic line-length scoring, no search tree. Makes mistakes and plays randomly sometimes. Good for young children. |
| ⚡ Intermediate | 4 | 5% | Minimax with alpha-beta pruning. Good for learning and casual play. Recognizes threats but misses combos. |
| 🏆 Expert | 6 | 0% | Full pattern-matching evaluation (live4, sleep3, etc.). Detects double threats (four-three, double-four). Strategic play with strong offense and defense. |
| 👑 Master | 8 | 0% | Deeper search with opening book (first 12 moves from pre-defined book) and endgame solver when <30 stones remain. |

**Progressive Unlock**: In production, difficulty auto-unlocks as the player wins:
- 0 wins → Beginner
- 1 win → Intermediate unlocked
- 3 wins → Expert unlocked
- 5 wins → Master unlocked

**AI Algorithm Architecture** (see `src/gomokuAI.js`):
1. **Pattern Library** — Classifies connected lines into threat categories: `live4`, `sleep4`, `live3`, `sleep3`, etc. with open/blocked end detection
2. **Threat Classifier** — Scans the board for all active threats per player across 4 directions
3. **Double-Threat Detector** (Expert+) — Identifies unblockable combos: four-three, double-four, triple-three
4. **Minimax Engine** — Alpha-beta pruning with threat-move candidate generation (radius-2 adjacency)
5. **Opening Book** (Master) — Standard center-first opening moves for the first 12 plies
6. **Error Injection** — Controlled suboptimal move probability for lower difficulties

**Tuning knobs** (in `GOMOKU_AI_CONFIGS`):
- `searchDepth`: Minimax tree depth (2, 4, 6, 8)
- `errorRate`: Probability of playing a suboptimal move (0.30, 0.05, 0.0)
- `patternScope`: `'basic'` (line-length only) vs `'full'` (all patterns scored)
- `doubleThreatDetection`: Boolean for four-three / double-four detection
- `openingBook` / `endgameSolver`: Master-level features

**Worker integration**: The AI runs in a dedicated Web Worker (`gomokuWorker.js`) via Blob URL to avoid blocking the UI thread. The worker delegates to `chooseGomokuAIMove()` from `gomokuAI.js`.

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
