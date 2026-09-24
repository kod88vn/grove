// Local dense crossword generator.
// Produces real intersecting puzzles when the AI is unavailable.

const WORD_POOLS = {
  elementary: [
    { answer: 'APPLE', clue: 'Red or green fruit' },
    { answer: 'TIGER', clue: 'Big striped cat' },
    { answer: 'PLANE', clue: 'Flies in the sky' },
    { answer: 'TRAIN', clue: 'Runs on rails' },
    { answer: 'HOUSE', clue: 'Where you live' },
    { answer: 'SNAKE', clue: 'Long slithering animal' },
    { answer: 'BREAD', clue: 'Baked food' },
    { answer: 'CLOUD', clue: 'White in the sky' },
    { answer: 'EARTH', clue: 'Our home planet' },
    { answer: 'STAR', clue: 'Twinkles at night' },
    { answer: 'MOON', clue: 'Glows in the sky' },
    { answer: 'TREE', clue: 'Tall plant with leaves' },
    { answer: 'BIRD', clue: 'Animal that flies' },
    { answer: 'FISH', clue: 'Lives in water' },
    { answer: 'CAKE', clue: 'Birthday sweet' },
    { answer: 'BOOK', clue: 'Pages and a story' },
    { answer: 'BALL', clue: 'Round bouncing toy' },
    { answer: 'KITE', clue: 'Flies on a string' },
    { answer: 'LEAF', clue: 'Falls from a tree' },
    { answer: 'RAIN', clue: 'Water from clouds' },
    { answer: 'SNOW', clue: 'Cold white flakes' },
    { answer: 'MILK', clue: 'White drink from cows' },
    { answer: 'CAT', clue: 'A pet that purrs' },
    { answer: 'DOG', clue: 'Animal that barks' },
    { answer: 'SUN', clue: 'Bright in the sky' },
    { answer: 'BEE', clue: 'Buzzing insect' },
    { answer: 'OWL', clue: 'Hoots at night' },
    { answer: 'COW', clue: 'Says moo' },
    { answer: 'BUS', clue: 'Big school ride' },
    { answer: 'EGG', clue: 'Comes from a hen' },
  ],
  middleschool: [
    { answer: 'GALAXY', clue: 'Huge system of stars' },
    { answer: 'PLANET', clue: 'Orbits a star' },
    { answer: 'COMET', clue: 'Icy space traveler' },
    { answer: 'ORBIT', clue: 'Path around a body' },
    { answer: 'NOVA', clue: 'Stellar explosion' },
    { answer: 'ATOM', clue: 'Smallest matter unit' },
    { answer: 'ENERGY', clue: 'Capacity to do work' },
    { answer: 'GRAVITY', clue: 'Pulls things down' },
    { answer: 'ALGEBRA', clue: 'Math with variables' },
    { answer: 'FRACTION', clue: 'Part of a whole' },
    { answer: 'BIOLOGY', clue: 'Study of life' },
    { answer: 'CELL', clue: 'Basic life unit' },
    { answer: 'GENE', clue: 'Hereditary unit' },
    { answer: 'WIND', clue: 'Moving air' },
    { answer: 'OCEAN', clue: 'Large salty body' },
    { answer: 'RIVER', clue: 'Flows to the sea' },
    { answer: 'CASTLE', clue: 'Royal stone home' },
    { answer: 'PIANO', clue: 'Keyed instrument' },
    { answer: 'MUSIC', clue: 'Organized sound' },
    { answer: 'RHYTHM', clue: 'Musical beat' },
    { answer: 'NORTH', clue: 'Compass direction' },
    { answer: 'EARTH', clue: 'Our home planet' },
    { answer: 'METAL', clue: 'Like copper or iron' },
    { answer: 'ECHO', clue: 'Repeated sound' },
    { answer: 'CIRCUIT', clue: 'Path for electricity' },
    { answer: 'COMPASS', clue: 'Tool that points north' },
    { answer: 'HARMONY', clue: 'Notes sounding good together' },
    { answer: 'VOLCANO', clue: 'Erupting mountain' },
    { answer: 'WEATHER', clue: 'Daily sky conditions' },
    { answer: 'KINGDOM', clue: 'Biology category' },
  ],
  highschool: [
    { answer: 'CALCULUS', clue: 'Math of change' },
    { answer: 'ALGEBRA', clue: 'Math with variables' },
    { answer: 'MATRIX', clue: 'Numeric grid' },
    { answer: 'INTEGRAL', clue: 'Area-under-curve operator' },
    { answer: 'FUNCTION', clue: 'Maps inputs to outputs' },
    { answer: 'PHYSICS', clue: 'Study of matter and energy' },
    { answer: 'QUANTUM', clue: 'Discrete unit of energy' },
    { answer: 'GRAVITY', clue: 'Mass attraction force' },
    { answer: 'PHOTON', clue: 'Light particle' },
    { answer: 'ELECTRON', clue: 'Negative subatomic particle' },
    { answer: 'BIOLOGY', clue: 'Study of life' },
    { answer: 'GENOME', clue: 'Full genetic code' },
    { answer: 'PROTEIN', clue: 'Cellular workhorse' },
    { answer: 'ENZYME', clue: 'Catalyzing protein' },
    { answer: 'ISOTOPE', clue: 'Atomic variant' },
    { answer: 'CATALYST', clue: 'Reaction speeder' },
    { answer: 'METAPHOR', clue: 'Implicit comparison' },
    { answer: 'IRONY', clue: 'Opposite-meaning device' },
    { answer: 'RHETORIC', clue: 'Persuasion art' },
    { answer: 'JUSTICE', clue: 'Fair treatment' },
    { answer: 'LIBERTY', clue: 'Freedom' },
    { answer: 'EMPIRE', clue: 'Vast political domain' },
    { answer: 'TREATY', clue: 'Formal agreement' },
    { answer: 'NEURON', clue: 'Nerve cell' },
    { answer: 'VECTOR', clue: 'Magnitude with direction' },
    { answer: 'THEOREM', clue: 'Proven proposition' },
    { answer: 'AXIOM', clue: 'Self-evident truth' },
    { answer: 'POLYMER', clue: 'Long molecular chain' },
    { answer: 'NUCLEUS', clue: 'Atom core' },
    { answer: 'ORGANIC', clue: 'Carbon-based' },
  ],
}

const TARGETS = { elementary: 8, middleschool: 12, highschool: 16 }

function seededShuffle(array, seed) {
  const out = array.slice()
  let s = Math.abs(Math.floor(seed * 1e9)) || 1
  for (let i = out.length - 1; i > 0; i -= 1) {
    s = (s * 9301 + 49297) % 233280
    const j = s % (i + 1)
    const tmp = out[i]
    out[i] = out[j]
    out[j] = tmp
  }
  return out
}

function buildCellMap(placed) {
  const cells = new Map()
  for (const p of placed) {
    for (let k = 0; k < p.answer.length; k += 1) {
      const r = p.row + (p.direction === 'down' ? k : 0)
      const c = p.col + (p.direction === 'across' ? k : 0)
      cells.set(`${r},${c}`, p.answer[k])
    }
  }
  return cells
}

function canPlace(answer, row, col, direction, cells) {
  let intersected = false
  for (let k = 0; k < answer.length; k += 1) {
    const r = row + (direction === 'down' ? k : 0)
    const c = col + (direction === 'across' ? k : 0)
    const key = `${r},${c}`
    const existing = cells.get(key)
    if (existing) {
      if (existing !== answer[k]) return false
      intersected = true
    } else {
      const perpA = direction === 'down' ? `${r},${c - 1}` : `${r - 1},${c}`
      const perpB = direction === 'down' ? `${r},${c + 1}` : `${r + 1},${c}`
      if (cells.has(perpA) || cells.has(perpB)) return false
    }
  }
  const preR = row - (direction === 'down' ? 1 : 0)
  const preC = col - (direction === 'across' ? 1 : 0)
  const postR = row + (direction === 'down' ? answer.length : 0)
  const postC = col + (direction === 'across' ? answer.length : 0)
  if (cells.has(`${preR},${preC}`)) return false
  if (cells.has(`${postR},${postC}`)) return false
  return intersected
}

function tryPlaceWord(word, placed) {
  const cells = buildCellMap(placed)
  for (const p of placed) {
    for (let i = 0; i < p.answer.length; i += 1) {
      for (let j = 0; j < word.answer.length; j += 1) {
        if (p.answer[i] !== word.answer[j]) continue
        const newDirection = p.direction === 'across' ? 'down' : 'across'
        const r = p.direction === 'across' ? p.row - j : p.row + i
        const c = p.direction === 'across' ? p.col + i : p.col - j
        if (canPlace(word.answer, r, c, newDirection, cells)) {
          return { row: r, col: c, direction: newDirection }
        }
      }
    }
  }
  return null
}

function generateAttempt(pool, seed, target) {
  const order = seededShuffle(pool, seed)
  const longestPool = order.slice().sort((a, b) => b.answer.length - a.answer.length).slice(0, 5)
  const first = longestPool[Math.abs(Math.floor(seed * 100)) % longestPool.length]
  const placed = [{ ...first, row: 0, col: 0, direction: 'across' }]
  const remaining = order.filter((w) => w.answer !== first.answer)

  let progress = true
  while (progress && placed.length < target) {
    progress = false
    for (let i = 0; i < remaining.length; i += 1) {
      const word = remaining[i]
      const placement = tryPlaceWord(word, placed)
      if (placement) {
        placed.push({ ...word, ...placement })
        remaining.splice(i, 1)
        progress = true
        if (placed.length >= target) break
        i -= 1
      }
    }
  }
  return placed
}

export function generateCrossword(level = 'elementary', seed = Math.random(), options = {}) {
  const customPool = Array.isArray(options.pool) ? options.pool : null
  const pool = customPool && customPool.length >= 4 ? customPool : (WORD_POOLS[level] ?? WORD_POOLS.elementary)
  const target = options.targetEntries ?? TARGETS[level] ?? 8

  let best = []
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const attemptSeed = (Math.abs(seed) + attempt * 0.137) % 1
    const placed = generateAttempt(pool, attemptSeed, target)
    if (placed.length > best.length) best = placed
    if (best.length >= target) break
  }
  if (best.length < 4) best = generateAttempt(pool, 0.1, 4)

  let minRow = Infinity
  let minCol = Infinity
  for (const p of best) {
    if (p.row < minRow) minRow = p.row
    if (p.col < minCol) minCol = p.col
  }

  const acrossEntries = []
  const downEntries = []
  for (const p of best) {
    if (p.direction === 'across') acrossEntries.push(p)
    else downEntries.push(p)
  }
  const ordered = [...acrossEntries, ...downEntries]
  const entries = ordered.map((p, idx) => ({
    id: String(idx + 1),
    clue: p.clue,
    answer: p.answer,
    row: p.row - minRow,
    col: p.col - minCol,
    direction: p.direction,
  }))
  const titleByLevel = {
    elementary: 'Elementary Crossword',
    middleschool: 'Middle School Crossword',
    highschool: 'High School Crossword',
  }
  return { title: titleByLevel[level] ?? 'Crossword', level, entries }
}

export const CROSSWORD_WORD_POOLS = WORD_POOLS
export const CROSSWORD_TARGETS = TARGETS
