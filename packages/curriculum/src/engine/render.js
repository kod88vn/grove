import { createRng } from './rng.js'

function templateName(template) {
  return template && typeof template.id === 'string' ? template.id : 'unknown template'
}

function fail(template, message) {
  throw new TypeError(`${templateName(template)}: ${message}`)
}

function validateTemplate(template) {
  if (!template || typeof template !== 'object') fail(template, 'template is invalid')
  if (typeof template.id !== 'string' || template.id.length === 0) fail(template, 'id is invalid')
  if (typeof template.skill !== 'string' || template.skill.length === 0) fail(template, 'skill is invalid')
  if (typeof template.widget !== 'string' || template.widget.length === 0) fail(template, 'widget is invalid')
  if (!Number.isInteger(template.version) || template.version < 1) fail(template, 'version is invalid')
  if (!Number.isInteger(template.difficulty) || template.difficulty < 1 || template.difficulty > 3) fail(template, 'difficulty is invalid')
  if (typeof template.generate !== 'function') fail(template, 'generate is invalid')
}

function validateOutput(template, output) {
  if (!output || typeof output !== 'object') fail(template, 'generated output is invalid')
  const allowed = new Set(['prompt', 'visual', 'answer', 'hints', 'explanation'])
  if (Object.keys(output).some((key) => !allowed.has(key))) fail(template, 'generated output has an unknown key')
  if (typeof output.prompt !== 'string' || output.prompt.length === 0) fail(template, 'prompt is invalid')
  if (output.answer === undefined || output.answer === null) fail(template, 'answer is invalid')
  if (!Array.isArray(output.hints) || output.hints.some((hint) => typeof hint !== 'string' || hint.length === 0)) fail(template, 'hints are invalid')
  if (typeof output.explanation !== 'string' || output.explanation.length === 0) fail(template, 'explanation is invalid')
}

export function render(template, seed) {
  const rng = createRng(seed)
  validateTemplate(template)
  const output = template.generate(rng)
  validateOutput(template, output)
  return {
    problemId: template.id,
    skill: template.skill,
    version: template.version,
    difficulty: template.difficulty,
    widget: template.widget,
    seed,
    prompt: output.prompt,
    visual: output.visual ?? null,
    answer: output.answer,
    hints: output.hints,
    explanation: output.explanation,
  }
}