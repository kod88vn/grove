export const MODULE_DOMAINS = {
  learning: {
    id: 'learning',
    title: 'Educational',
    description: 'Learning games and activities kids can start quickly.',
  },
  household: {
    id: 'household',
    title: 'Household Utility',
    description: 'Family helpers for day-to-day planning and organization.',
  },
}

export const MODULE_REGISTRY = [
  {
    id: 'chat',
    slug: 'chat',
    title: 'Nora Chat',
    summary: 'The central assistant experience for conversation and guidance.',
    domain: 'household',
    href: '/chat',
    status: 'live',
  },
  {
    id: 'crossword',
    slug: 'crossword',
    title: 'Crossword Builder',
    summary: 'Kid-friendly clues and word puzzles with adjustable difficulty.',
    domain: 'learning',
    href: '/modules/crossword',
    status: 'planned',
  },
  {
    id: 'hangman',
    slug: 'hangman',
    title: 'Hangman',
    summary: 'Vocabulary game with themed word packs and hints.',
    domain: 'learning',
    href: '/modules/hangman',
    status: 'planned',
  },
  {
    id: 'sudoku',
    slug: 'sudoku',
    title: 'Sudoku',
    summary: 'Progressive logic puzzles for short learning sessions.',
    domain: 'learning',
    href: '/modules/sudoku',
    status: 'planned',
  },
  {
    id: 'shopping-list',
    slug: 'shopping-list',
    title: 'Shopping List',
    summary: 'Shared grocery planning with family-friendly quick add flows.',
    domain: 'household',
    href: '/modules/shopping-list',
    status: 'planned',
  },
  {
    id: 'reminders',
    slug: 'reminders',
    title: 'Reminders',
    summary: 'Simple recurring reminders for chores, school, and routines.',
    domain: 'household',
    href: '/modules/reminders',
    status: 'planned',
  },
  {
    id: 'document-manager',
    slug: 'document-manager',
    title: 'Document Manager',
    summary: 'Organize home documents with searchable tags and categories.',
    domain: 'household',
    href: '/modules/document-manager',
    status: 'planned',
  },
]

export function getModuleBySlug(slug) {
  return MODULE_REGISTRY.find((module) => module.slug === slug)
}

export function getModulesByDomain(domain) {
  return MODULE_REGISTRY.filter((module) => module.domain === domain)
}
