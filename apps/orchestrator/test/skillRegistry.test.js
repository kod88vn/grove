import test from 'node:test'
import assert from 'node:assert/strict'

import { buildSkillPromptPack, getSkillDefinition, resolveSkills, validateSkillManifest } from '../src/skillRegistry.js'

test('Given weather_widget, when loading the skill definition, then strict structured settings are returned', () => {
  const skill = getSkillDefinition('weather_widget')

  assert.equal(skill.id, 'weather_widget')
  assert.equal(skill.responseMode, 'structured_data')
  assert.equal(skill.schemaName, 'weather_v1')
  assert.equal(skill.allowProse, false)
  assert.deepEqual(skill.allowedTools, ['weather_provider'])
})

test('Given known skill ids, when resolving skills, then only requested definitions are returned', () => {
  const skills = resolveSkills(['general_family_chat', 'local_time'])

  assert.equal(skills.length, 2)
  assert.equal(skills[0].id, 'general_family_chat')
  assert.equal(skills[1].id, 'local_time')
})

test('Given selected skill ids, when building prompt pack, then only selected skill instructions are included', () => {
  const promptPack = buildSkillPromptPack(['general_family_chat'])

  assert.equal(typeof promptPack, 'string')
  assert.equal(promptPack.includes('general_family_chat'), true)
  assert.equal(promptPack.includes('weather_widget'), false)
  assert.equal(promptPack.includes('local_time'), false)
})

test('Given schema-compliant manifest, when validating, then manifest is accepted', () => {
  const manifest = {
    schemaVersion: '1.0',
    id: 'test_skill',
    purpose: 'Test purpose',
    instructions: 'Test instructions',
    triggerPatterns: ['test'],
    allowedTools: ['tool_a'],
    modelProfile: 'fast',
    responseMode: 'chat',
    schemaName: null,
    verificationPolicy: 'none',
    allowProse: true,
  }

  const validated = validateSkillManifest(manifest, 'inline-test')
  assert.equal(validated.id, 'test_skill')
})

test('Given schema-invalid manifest, when validating, then detailed error is thrown', () => {
  const invalidManifest = {
    schemaVersion: '1.0',
    id: 'Bad-Id',
    purpose: 'Test purpose',
    instructions: 'Test instructions',
    triggerPatterns: ['test'],
    allowedTools: [],
    modelProfile: 'fast',
    responseMode: 'chat',
    schemaName: null,
    verificationPolicy: 'none',
    allowProse: true,
  }

  assert.throws(
    () => validateSkillManifest(invalidManifest, 'inline-invalid-test'),
    /Invalid skill manifest \(inline-invalid-test\)/
  )
})