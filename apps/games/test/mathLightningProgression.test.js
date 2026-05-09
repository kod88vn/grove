import test from 'node:test'
import assert from 'node:assert/strict'

import {
  MATH_LIGHTNING_LEVELS,
  adjustMathLightningLevel,
  generateMathLightningQuestion,
  scoreMathLightningAnswer,
} from '../src/mathLightning.js'

test('math lightning level progression clamps at bounds', () => {
  assert.equal(adjustMathLightningLevel(0, false), 0)
  assert.equal(adjustMathLightningLevel(0, true), 1)

  const top = MATH_LIGHTNING_LEVELS.length - 1
  assert.equal(adjustMathLightningLevel(top, true), top)
  assert.equal(adjustMathLightningLevel(top, false), top - 1)
})

test('math lightning question generation respects configured range', () => {
  const rookie = generateMathLightningQuestion(0, () => 0)
  assert.deepEqual(rookie, { a: 1, b: 1, answer: 1 })

  const lightning = generateMathLightningQuestion(3, () => 0.999999)
  assert.equal(lightning.a <= MATH_LIGHTNING_LEVELS[3].range, true)
  assert.equal(lightning.b <= MATH_LIGHTNING_LEVELS[3].range, true)
  assert.equal(lightning.answer, lightning.a * lightning.b)
})

test('math lightning score rewards higher levels more', () => {
  const rookie = scoreMathLightningAnswer({
    userInput: '12',
    answer: 12,
    timeLeft: 5,
    levelIndex: 0,
    isTimeout: false,
  })
  const lightning = scoreMathLightningAnswer({
    userInput: '12',
    answer: 12,
    timeLeft: 5,
    levelIndex: 3,
    isTimeout: false,
  })

  assert.equal(rookie.isCorrect, true)
  assert.equal(lightning.isCorrect, true)
  assert.equal(lightning.points > rookie.points, true)
})

test('math lightning score is zero for wrong or timeout answers', () => {
  const wrong = scoreMathLightningAnswer({
    userInput: '11',
    answer: 12,
    timeLeft: 5,
    levelIndex: 2,
    isTimeout: false,
  })
  const timeout = scoreMathLightningAnswer({
    userInput: '12',
    answer: 12,
    timeLeft: 5,
    levelIndex: 2,
    isTimeout: true,
  })

  assert.deepEqual(wrong, { isCorrect: false, points: 0 })
  assert.deepEqual(timeout, { isCorrect: false, points: 0 })
})
