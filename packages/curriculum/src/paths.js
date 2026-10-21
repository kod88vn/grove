// Study paths (HOMEWORK_PLAN.md §5: "Paths ... ending in a 👑 boss problem").
// A path is the prerequisite chain of its terminal skill plus that skill,
// and it ends in the terminal skill's boss problem. Paths are data derived
// from the catalog's `prerequisites` graph; nothing here generates content.
import { skills as grade05Math } from './catalog/math/grade-05.js'

// The three Grade 5 paths shipped with U05 M-MASTERY. Each boss problem is a
// registered template of its terminal skill (see problems/math/g05/*-boss.js).
export const pathDefinitions = [
  {
    id: 'fraction-forest',
    name: 'Fraction Forest',
    icon: '🌲',
    terminal: 'm5.nf.add-fractions-unlike',
    boss: 'm5.nf.add-fractions-unlike/fraction-boss',
  },
  {
    id: 'expression-express',
    name: 'Expression Express',
    icon: '🚂',
    terminal: 'm5.oa.variables',
    boss: 'm5.oa.variables/expression-boss',
  },
  {
    id: 'shape-scout',
    name: 'Shape Scout',
    icon: '📍',
    terminal: 'm5.g.coordinate-plane',
    boss: 'm5.g.coordinate-plane/rectangle-boss',
  },
]

function buildSkillIndex(skills) {
  return new Map(skills.map((skill) => [skill.id, skill]))
}

// Flattened prerequisite chain in dependency order: a skill's own
// prerequisites come first (recursively), then the skill itself. Duplicates
// keep their first position so a diamond graph stays a list, not a tree.
function prerequisiteChain(skillId, byId, seen = new Set()) {
  if (seen.has(skillId)) return []
  seen.add(skillId)
  const skill = byId.get(skillId)
  if (!skill) return []
  const chain = []
  for (const prerequisite of skill.prerequisites ?? []) {
    for (const id of prerequisiteChain(prerequisite, byId, seen)) chain.push(id)
  }
  chain.push(skillId)
  return chain
}

function pathSkills(definition, byId) {
  return prerequisiteChain(definition.terminal, byId)
}

// listPaths(grade) — one entry per path whose terminal skill is of `grade`.
// Each entry carries the full chain (prerequisites first, terminal last) so a
// client can walk it and the mastery layer can mark each step's state.
export function listPaths(grade) {
  const byId = buildSkillIndex(grade05Math)
  return pathDefinitions
    .map((definition) => {
      const terminal = byId.get(definition.terminal)
      if (!terminal) return null
      if (typeof grade === 'number' && terminal.grade !== grade) return null
      return {
        id: definition.id,
        name: definition.name,
        icon: definition.icon,
        grade: terminal.grade,
        subject: terminal.subject,
        terminal: definition.terminal,
        bossProblemId: definition.boss,
        skills: pathSkills(definition, byId),
      }
    })
    .filter(Boolean)
}

export function getPath(id) {
  return listPaths().find((path) => path.id === id) ?? null
}
