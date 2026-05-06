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
    summary: 'Kid-friendly clue challenge with quick laugh-sized rounds.',
    domain: 'learning',
    href: '/modules/crossword',
    status: 'live',
  },
  {
    id: 'hangman',
    slug: 'hangman',
    title: 'Hangman',
    summary: 'Vocabulary guessing game with silly themed word packs and hints.',
    domain: 'learning',
    href: '/modules/hangman',
    status: 'live',
  },
  {
    id: 'sudoku',
    slug: 'sudoku',
    title: 'Sudoku',
    summary: 'Mini 4x4 logic puzzle for short confidence-building sessions.',
    domain: 'learning',
    href: '/modules/sudoku',
    status: 'live',
  },
  {
    id: 'gomoku',
    slug: 'gomoku',
    title: 'Gomoku',
    summary: 'Five-in-a-row duel versus Nora AI on an auto-expanding board.',
    domain: 'learning',
    href: '/modules/gomoku',
    status: 'live',
  },
  {
    id: 'math-lightning',
    slug: 'math-lightning',
    title: 'Math Lightning',
    summary: 'Multiplication speed challenge with levels and leaderboard.',
    domain: 'learning',
    href: '/modules/math-lightning',
    status: 'live',
  },
  {
    id: 'word-scramble',
    slug: 'word-scramble',
    title: 'Word Scramble',
    summary: 'Unscramble the letters to reveal hidden words and build vocabulary.',
    domain: 'learning',
    href: '/modules/word-scramble',
    status: 'live',
  },
  {
    id: 'memory-match',
    slug: 'memory-match',
    title: 'Memory Match',
    summary: 'Find the animal pairs in this classic concentration card game.',
    domain: 'learning',
    href: '/modules/memory-match',
    status: 'live',
  },
  {
    id: 'logic-code',
    slug: 'logic-code',
    title: 'Logic Code',
    summary: 'Mastermind-style pattern guessing to train deductive reasoning skills.',
    domain: 'learning',
    href: '/modules/logic-code',
    status: 'live',
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
