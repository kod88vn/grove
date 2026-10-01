import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const progress = readFileSync(new URL('./HOMEWORK_PROGRESS.md', import.meta.url), 'utf8');
const plan = readFileSync(new URL('./HOMEWORK_PLAN.md', import.meta.url), 'utf8');

function unitRow(unit) {
  return progress.split('\n').find((line) => line.startsWith(`| [ ] ${unit} |`));
}

test('reviewed spelling and playable audio-spell ship in the same English unit', () => {
  const spellingUnit = unitRow('E6c-1B');
  assert.ok(spellingUnit, 'the spelling unit must exist');
  assert.match(spellingUnit, /P2\.12/);
  assert.match(spellingUnit, /audio-spell/);
  assert.match(spellingUnit, /review/i);
  assert.equal(unitRow('E-SPELL'), undefined, 'spelling must not be deferred to a later PR');
  assert.match(plan, /P2\.12[^\n]*E6c-1B|E6c-1B[^\n]*P2\.12/);
});

test('gallery acceptance depends on the completed spelling unit', () => {
  const gallery = unitRow('W-GALLERY');
  assert.ok(gallery, 'the final gallery unit must exist');
  assert.match(gallery, /E6c-1B/);
  assert.doesNotMatch(gallery, /E-SPELL/);
  assert.match(progress, /P2\.5[^\n]*E6c-1B|E6c-1B[^\n]*P2\.5/);
});