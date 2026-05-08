# Reminders

Source-of-truth workspace for Grove reminder and routine functionality.

This app owns the shared reminder data model and app-level metadata so recurring chores, school reminders, and household routines do not sit inside Nora.

Current layout:

- `src/index.js` — app metadata and reminder-state helpers
- `test/smoke.test.js` — workspace smoke coverage

## Tests

```bash
yarn workspace @grove/reminders test
```