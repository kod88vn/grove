import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Ajv from 'ajv'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const skillsDir = path.join(currentDir, 'skills')
const schemaPath = path.join(skillsDir, 'schema.json')

let registryCache = null
let validateSkillSchema = null

function buildSchemaValidator() {
  if (validateSkillSchema) return validateSkillSchema

  const schema = JSON.parse(readFileSync(schemaPath, 'utf8'))
  const ajv = new Ajv({ allErrors: true, strict: true })
  validateSkillSchema = ajv.compile(schema)
  return validateSkillSchema
}

function formatSchemaErrors(errors = []) {
  return errors
    .map((error) => {
      const location = error.instancePath || '/'
      return `${location} ${error.message}`.trim()
    })
    .join('; ')
}

export function validateSkillManifest(skill, source = 'inline') {
  const validate = buildSchemaValidator()
  const valid = validate(skill)

  if (!valid) {
    throw new Error(`Invalid skill manifest (${source}): ${formatSchemaErrors(validate.errors)}`)
  }

  return skill
}

function loadSkillRegistry() {
  if (registryCache) return registryCache

  const files = readdirSync(skillsDir).filter((file) => file.endsWith('.json') && file !== 'schema.json')
  registryCache = new Map(
    files.map((file) => {
      const fullPath = path.join(skillsDir, file)
      const skill = JSON.parse(readFileSync(fullPath, 'utf8'))
      return [skill.id, validateSkillManifest(skill, file)]
    })
  )

  return registryCache
}

export function getSkillDefinition(skillId) {
  const skill = loadSkillRegistry().get(skillId)
  if (!skill) {
    throw new Error(`Unknown skill: ${skillId}`)
  }

  return skill
}

export function resolveSkills(skillIds = []) {
  return skillIds.map((skillId) => getSkillDefinition(skillId))
}

export function listSkillDefinitions() {
  return [...loadSkillRegistry().values()]
}

export function buildSkillPromptPack(skillIds = []) {
  const skills = resolveSkills(skillIds)
  if (skills.length === 0) return ''

  return skills
    .map((skill) => `skill: ${skill.id}\n${skill.instructions}`)
    .join('\n\n')
}