# Games

Source-of-truth workspace for Grove educational games.

This package now owns both the shared rules/helpers and the game UI source that was previously embedded inside Nora.

Current layout:

- `src/index.js` — shared game rules and helpers
- `src/ModuleGameArcade.js` — top-level arcade renderer source
- `src/ui/` — individual game UI modules and arcade effects

## Tests

```bash
yarn workspace @grove/games test
```
