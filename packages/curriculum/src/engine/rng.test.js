/**
 * P1.2: engine/rng.js — seeded PRNG (mulberry32). Same seed, same problem (HOMEWORK_PLAN §6.1).
 *
 * The server picks a seed, stores it in session_items, and re-renders the problem from that
 * seed to check the answer (§6.6). So the sequence must be exactly mulberry32 on every
 * machine, forever: a change here silently changes every stored problem.
 *
 * Reference values come from the published mulberry32 (int32 state: `a = a + 0x6D2B79F5 | 0`),
 * computed once and pasted here — not read back from this implementation.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { createRng } from './rng.js'

const REFERENCE = {
  0: [0.26642920868471265, 0.0003297457005828619, 0.2232720274478197],
  1: [0.6270739405881613, 0.002735721180215478, 0.5274470399599522],
  42: [0.6011037519201636, 0.44829055899754167, 0.8524657934904099],
  4294967295: [0.8964226141106337, 0.189478256739676, 0.7156526781618595],
}

test('next() reproduces the reference mulberry32 sequence for each seed', () => {
  for (const [seed, expected] of Object.entries(REFERENCE)) {
    const rng = createRng(Number(seed))
    assert.deepEqual([rng.next(), rng.next(), rng.next()], expected, `seed ${seed}`)
  }
})

test('the state stays exact int32 arithmetic: draw 10,000,001 of seed 1 matches the reference', () => {
  // A version that lets the state grow as a double (`t = a += 0x6D2B79F5`) loses precision
  // after about 5 million draws and returns 0.9402102075982839 here instead.
  const rng = createRng(1)
  for (let i = 0; i < 10_000_000; i++) rng.next()
  assert.equal(rng.next(), 0.6385748186148703)
})

test('two generators with the same seed are independent and identical', () => {
  const a = createRng(7)
  const b = createRng(7)
  const fromA = [a.next(), a.next(), a.next(), a.next()]
  const fromB = [b.next(), b.next(), b.next(), b.next()]
  assert.deepEqual(fromA, fromB)
})

test('rejects a seed that is not an integer from 0 to 2^32 - 1', () => {
  for (const bad of [-1, 4294967296, 1.5, NaN, Infinity, '1', null, undefined, 1n]) {
    assert.throws(() => createRng(bad), RangeError, `seed ${String(bad)}`)
  }
})

test('next() stays in [0, 1)', () => {
  const rng = createRng(123)
  for (let i = 0; i < 10_000; i++) {
    const x = rng.next()
    assert.ok(x >= 0 && x < 1, `draw ${i} was ${x}`)
  }
})

test('int(min, max) is min + floor(next() * (max - min + 1)), inclusive of both ends', () => {
  const rng = createRng(99)
  const twin = createRng(99)
  for (let i = 0; i < 200; i++) {
    assert.equal(rng.int(-3, 12), -3 + Math.floor(twin.next() * 16))
  }
})

test('int(min, max) reaches both endpoints and nothing outside them', () => {
  const rng = createRng(5)
  const seen = new Set()
  for (let i = 0; i < 2_000; i++) seen.add(rng.int(2, 10))
  assert.deepEqual([...seen].sort((x, y) => x - y), [2, 3, 4, 5, 6, 7, 8, 9, 10])
})

test('int(n, n) always returns n', () => {
  const rng = createRng(3)
  for (let i = 0; i < 20; i++) assert.equal(rng.int(4, 4), 4)
})

test('int rejects bounds that are not safe integers, or min greater than max', () => {
  const rng = createRng(1)
  assert.throws(() => rng.int(5, 4), RangeError)
  assert.throws(() => rng.int(1.5, 4), RangeError)
  assert.throws(() => rng.int(1, 4.5), RangeError)
  assert.throws(() => rng.int('1', 4), RangeError)
  assert.throws(() => rng.int(0, 2 ** 53), RangeError)
})

test('pick(items) is items[int(0, items.length - 1)]', () => {
  const items = ['ant', 'bee', 'cat', 'dog', 'eel']
  const rng = createRng(2024)
  const twin = createRng(2024)
  for (let i = 0; i < 50; i++) {
    assert.equal(rng.pick(items), items[twin.int(0, items.length - 1)])
  }
})

test('pick rejects an empty list or a value that is not an array', () => {
  const rng = createRng(1)
  assert.throws(() => rng.pick([]), RangeError)
  assert.throws(() => rng.pick('abc'), TypeError)
  assert.throws(() => rng.pick(undefined), TypeError)
})

test('shuffle(items) is Fisher–Yates from the end with int(0, i), and returns a new array', () => {
  const items = [1, 2, 3, 4, 5, 6, 7, 8]
  const before = [...items]
  const rng = createRng(31337)
  const twin = createRng(31337)

  const expected = [...items]
  for (let i = expected.length - 1; i > 0; i--) {
    const j = twin.int(0, i)
    ;[expected[i], expected[j]] = [expected[j], expected[i]]
  }

  const shuffled = rng.shuffle(items)
  assert.deepEqual(shuffled, expected)
  assert.notEqual(shuffled, items)
  assert.deepEqual(items, before, 'the input array is not mutated')
})

test('shuffle rejects a value that is not an array', () => {
  const rng = createRng(1)
  assert.throws(() => rng.shuffle('abc'), TypeError)
})
