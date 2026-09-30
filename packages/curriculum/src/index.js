// Future exports: listSkills, getSkill, listProblems, render, check and hint.
import { skills as englishSkills } from './catalog/english/grade-05.js'
import { skills as mathSkills } from './catalog/math/grade-05.js'
import { templates as contextClueTemplates } from './problems/english/g05/context-clues.js'
import { templates as findTheClueTemplates } from './problems/english/g05/find-the-clue.js'
import { templates as clockElapsedTimeTemplates } from './problems/math/g05/clock-elapsed-time.js'
import { templates as coinsValueTemplates } from './problems/math/g05/coins-value.js'
import { templates as fractionsTemplates } from './problems/math/g05/add-fractions-unlike.js'
import { templates as multiplicationTemplates } from './problems/math/g05/long-multiplication.js'
import { templates as matchExpressionsTemplates } from './problems/math/g05/match-expressions.js'
import { templates as orderOfOperationsTemplates } from './problems/math/g05/order-of-operations.js'
import { templates as orderDecimalsTemplates } from './problems/math/g05/order-decimals.js'
import { templates as primeCompositeTemplates } from './problems/math/g05/prime-composite.js'
import { templates as sortQuadrilateralsTemplates } from './problems/math/g05/sort-quadrilaterals.js'

export { render } from './engine/render.js'
export { check } from './engine/check.js'

const catalogSkills = [...mathSkills, ...englishSkills]
const problemTemplates = [
  ...contextClueTemplates,
  ...findTheClueTemplates,
  ...clockElapsedTimeTemplates,
  ...coinsValueTemplates,
  ...fractionsTemplates,
  ...multiplicationTemplates,
  ...matchExpressionsTemplates,
  ...orderOfOperationsTemplates,
  ...orderDecimalsTemplates,
  ...primeCompositeTemplates,
  ...sortQuadrilateralsTemplates,
]
const skillById = new Map(catalogSkills.map((skill) => [skill.id, skill]))

const matches = (row, filter, keys) => {
  if (!filter) return true
  return keys.every((key) => filter[key] === undefined || row[key] === filter[key])
}

const copySkill = (skill) => ({
  ...skill,
  ccss: [...skill.ccss],
  prerequisites: [...skill.prerequisites],
})

export function listSkills(filter) {
  return catalogSkills
    .filter((skill) => matches(skill, filter, ['subject', 'grade', 'strand']))
    .map(copySkill)
}

export function getSkill(id) {
  if (typeof id !== 'string') return null
  const skill = skillById.get(id)
  return skill ? copySkill(skill) : null
}

export function listProblems(filter) {
  return problemTemplates
    .map((template) => {
      const skill = skillById.get(template.skill)
      return {
        id: template.id,
        skill: template.skill,
        subject: skill.subject,
        grade: skill.grade,
        title: template.title,
        difficulty: template.difficulty,
        widget: template.widget,
        version: template.version,
      }
    })
    .filter((problem) => matches(problem, filter, ['subject', 'grade', 'skill', 'difficulty']))
}

export function getProblem(id) {
  if (typeof id !== 'string') return null
  return problemTemplates.find((template) => template.id === id) ?? null
}

export function hint(rendered, used) {
  if (!Number.isInteger(used) || used < 0) throw new TypeError('used must be a non-negative integer')
  if (!rendered || typeof rendered !== 'object' || !Array.isArray(rendered.hints)) {
    throw new TypeError('rendered must have a hints array')
  }
  return used < rendered.hints.length ? rendered.hints[used] : null
}

const visualFields = {
  column: ['kind', 'operator', 'operands'],
  'fraction-sum': ['kind', 'operator', 'addends'],
  expression: ['kind', 'expression'],
  cloze: ['kind', 'sentence', 'choices'],
  choice: ['kind', 'options'],
  order: ['kind', 'items'],
  sort: ['kind', 'items', 'buckets'],
  match: ['kind', 'left', 'right'],
  clock: ['kind', 'start'],
  coins: ['kind', 'target', 'denominations'],
  'tap-select': ['kind', 'tokens', 'segments', 'blankIndex'],
}

export function toInstance(rendered) {
  if (!rendered || typeof rendered !== 'object' || Array.isArray(rendered)) {
    throw new TypeError('rendered must be an object')
  }

  let visual = null
  if (rendered.visual !== null) {
    if (!rendered.visual || typeof rendered.visual !== 'object' || Array.isArray(rendered.visual)) {
      throw new TypeError('visual must be null or an object')
    }
    const fields = visualFields[rendered.visual.kind]
    if (!fields) throw new TypeError('visual kind is not allowed')
    visual = Object.fromEntries(fields.map((field) => [field, rendered.visual[field]]))
  }

  return {
    problemId: rendered.problemId,
    skill: rendered.skill,
    widget: rendered.widget,
    difficulty: rendered.difficulty,
    version: rendered.version,
    seed: rendered.seed,
    prompt: rendered.prompt,
    visual,
  }
}
