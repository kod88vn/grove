# Shopping List

Source-of-truth workspace for Grove shopping-list functionality.

This app owns the shared data model and app-level metadata for the family's grocery and household list flows. It exists as its own workspace so shopping-list features do not live inside Nora.

Current layout:

- `src/index.js` — app metadata and list-state helpers
- `test/smoke.test.js` — workspace smoke coverage

## Tests

```bash
yarn workspace @grove/shopping-list test
```