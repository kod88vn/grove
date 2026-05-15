---
name: component-architecture
category: coding
tags: [components, architecture, next.js, react, design-patterns]
execution-mode: tool-call
description: 'Design and review React/Next.js component architecture. Use when creating new components, refactoring UI, or evaluating component boundaries and data flow.'
argument-hint: 'Component name, page to refactor, or architecture question'
---

# Component Architecture

## When to Use
- "Create a new component for..."
- "Refactor this page into components"
- "How should I structure this UI feature?"
- Reviewing component boundaries and data flow

## Groove Conventions

### Directory Structure
```
apps/<app>/
  app/           # Next.js App Router pages and API routes
  components/    # Shared UI components
  lib/           # Business logic utilities
  src/           # Legacy or non-Next.js code
```

### Component Rules
- Keep `apps/nora` thin — major capabilities live in sibling apps.
- Components go in `components/`, not inside `app/`.
- Server components by default; add `'use client'` only when interactivity is needed.
- Extract business logic to `lib/` — components should be presentational.

### Data Flow
- Pages fetch data → pass as props to components.
- API routes in `app/api/` handle external requests.
- Shared state via context only when props drilling exceeds 3 levels.

## Output Format

```
### Component Design: <name>

#### Location
- [Component](apps/<app>/components/<Name>.js)
- [Tests](apps/<app>/components/<Name>.test.js)

#### Props Interface
| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|

#### Usage Example
<code snippet showing how to import and use>