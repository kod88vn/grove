/**
 * @jest-environment node
 */
/**
 * P1.7 part 10 of 10 — one kid, one problem, end to end, for every template there is.
 *
 * The per-route tests each guard their own door. This one walks the corridor: create a
 * student, open a session, take an item, peek at the preview, spend a hint, get it wrong,
 * then get it right — through the real handlers, with nothing stubbed but the request
 * object. It exists to catch the leak no single route can see, because each payload is
 * innocent alone and the set of them is not.
 *
 * It is driven by listProblems(), so a template added in Phase 2 is covered the day it
 * lands rather than the day somebody remembers to add a test for it.
 *
 * The rule, in one line: before the kid answers correctly, nothing the server sends may
 * contain the answer, the working, or a hint they have not paid for.
 *
 * ASSUMED — the shape of "the answer" per widget, since §6.6 states the rule and not the
 * mechanics:
 *   number, column   the exact answer value must appear as no standalone number anywhere;
 *   fraction         the answer as written, `num/den`, must appear nowhere. The addends
 *                    legitimately carry num and den of their own, so the scan is on the
 *                    pair, not the digits;
 *   cloze            the word DOES appear — it is one of the choices, which is the whole
 *                    exercise. What must not appear is any marker of which choice is
 *                    right, and it must not appear in the sentence itself.
 */
import { beforeEach, describe, expect, it } from '@jest/globals'

import { getProblem, listProblems, render } from '@grove/curriculum'

import { getAttemptsBySession, getSessionItem, initDb } from '../../lib/db.js'

const { POST: createStudent } = require('./students/route')
const { GET: previewProblem } = require('./problems/[skill]/[template]/route')
const { POST: createSession } = require('./sessions/route')
const { POST: takeItem } = require('./sessions/[id]/items/route')
const { POST: askHint } = require('./hints/route')
const { POST: sendAttempt } = require('./attempts/route')

const BANNED_KEYS = ['answer', 'explanation', 'hints', 'steps', 'partials', 'parts', 'lcd']
const DATE = '2026-09-27'

const req = (body, url = 'http://localhost:3000/homeworks/api/x') => ({ url, json: async () => body })

const bodyOf = (res) => res.json()

const keysAtEveryDepth = (node, found = []) => {
  if (Array.isArray(node)) {
    for (const entry of node) keysAtEveryDepth(entry, found)
    return found
  }
  if (node && typeof node === 'object') {
    for (const [key, value] of Object.entries(node)) {
      found.push(key)
      keysAtEveryDepth(value, found)
    }
  }
  return found
}

const countsForCoins = (total, denominations) => {
  let remaining = total
  const counts = {}
  for (const coin of [...denominations].sort((left, right) => right - left)) {
    counts[coin] = Math.floor(remaining / coin)
    remaining %= coin
  }
  return counts
}

const rightResponse = (answer, widget) => {
  if (widget === 'fraction') return { text: `${answer.num}/${answer.den}` }
  if (widget === 'fraction-bar') return { text: `${answer.num * 2}/${answer.den * 2}` }
  if (widget === 'cloze') return { blanks: answer.blanks.map((blank) => blank.accept[0]) }
  if (widget === 'choice') return { id: answer.id }
  if (widget === 'order') return { sequence: answer.sequence }
  if (widget === 'sort') return { buckets: answer.buckets }
  if (widget === 'match') return { pairs: answer.pairs }
  if (widget === 'clock') return { hour: answer.hour, minute: answer.minute }
  if (widget === 'coins') return { counts: countsForCoins(answer.total, answer.denominations) }
  if (widget === 'tap-select') return { ids: [...answer.ids] }
  if (widget === 'number-line') return { text: `${answer.num * 2}/${answer.den * 2}` }
  return { value: answer.value }
}

const wrongResponse = (widget, answer) => {
  if (widget === 'fraction') return { text: '999/1000' }
  if (widget === 'cloze') return { blanks: ['zzzzzzz'] }
  if (widget === 'choice') return { id: 'zzzzzzz' }
  // A real arrangement of the real cards, just backwards — `wrong`, not `invalid`.
  if (widget === 'order') return { sequence: [...answer.sequence].reverse() }
  if (widget === 'sort') {
    // Every card placed, each in the next bucket along: finished, and misfiled.
    const ids = Object.keys(answer.buckets)
    return { buckets: Object.fromEntries(ids.map((id, index) => [id, answer.buckets[ids[(index + 1) % ids.length]]])) }
  }
  if (widget === 'match') {
    // Every card joined to something, each to the next one along: finished, and misjoined.
    const { pairs } = answer
    return { pairs: pairs.map((pair, index) => ({ left: pairs[(index + 1) % pairs.length].left, right: pair.right })) }
  }
  if (widget === 'clock') {
    // An hour late, on a face the child could really have set: `wrong`, not `invalid`.
    return { hour: (answer.hour % 12) + 1, minute: answer.minute }
  }
  if (widget === 'coins') {
    const counts = countsForCoins(answer.total, answer.denominations)
    counts[1] += 1
    return { counts }
  }
  if (widget === 'tap-select') return { ids: [answer.ids[0], answer.availableIds.find((id) => !answer.ids.includes(id))] }
  if (widget === 'fraction-bar') return { text: `0/${answer.den * 2}` }
  if (widget === 'number-line') return { text: '0/1' }
  return { value: -999999 }
}

async function walkTheCorridor(meta) {
  const [skill, template] = meta.id.split('/')

  const student = (
    await bodyOf(await createStudent(req({ displayName: 'Kid', avatar: '🦊', grade: meta.grade })))
  ).student

  const { sessionId } = await bodyOf(
    await createSession(
      req({ studentId: student.id, kind: 'daily', localDate: DATE, tz: 'America/New_York' })
    )
  )

  const item = await bodyOf(
    await takeItem(req({ problemId: meta.id }), { params: { id: sessionId } })
  )
  const { seed } = item

  const preview = await bodyOf(
    await previewProblem(
      req(null, `http://localhost:3000/homeworks/api/problems/${skill}/${template}?seed=${seed}`),
      { params: { skill, template } }
    )
  )

  const hinted = await bodyOf(await askHint(req({ sessionId, problemId: meta.id, seed })))

  const missed = await bodyOf(
    await sendAttempt(
      req({
        sessionId,
        problemId: meta.id,
        seed,
        response: wrongResponse(meta.widget, render(getProblem(meta.id), seed).answer),
        durationMs: 8000,
      })
    )
  )

  return { sessionId, seed, student, payloads: { item, preview, hinted, missed } }
}

beforeEach(() => {
  initDb(':memory:')
})

describe.each(listProblems().map((meta) => [meta.id, meta]))(
  'a practice run of %s',
  (_id, meta) => {
    it('gets the kid from a blank slate to a solved problem', async () => {
      const { sessionId, seed, payloads } = await walkTheCorridor(meta)
      const solution = render(getProblem(meta.id), seed)

      expect(typeof seed).toBe('number')
      expect(payloads.item.instance.problemId).toBe(meta.id)
      expect(payloads.preview.instance).toEqual(payloads.item.instance)
      expect(payloads.hinted.hintsUsed).toBe(1)
      expect(payloads.hinted.hint).toBe(solution.hints[0])
      expect(payloads.missed.correct).toBe(false)
      expect(getSessionItem(sessionId, meta.id, seed).tries).toBe(1)
      expect(getAttemptsBySession(sessionId)).toHaveLength(0)

      const solved = await bodyOf(
        await sendAttempt(
          req({
            sessionId,
            problemId: meta.id,
            seed,
            response: rightResponse(solution.answer, meta.widget),
            durationMs: 12000,
          })
        )
      )
      expect(solved.correct).toBe(true)
      expect(solved.stars).toBe(2)
      expect(solved.explanation).toBe(solution.explanation)
      expect(getSessionItem(sessionId, meta.id, seed).done).toBe(1)
      expect(getAttemptsBySession(sessionId)).toHaveLength(1)
    })

    it('never names the answer before the kid finds it', async () => {
      const { seed, payloads } = await walkTheCorridor(meta)
      const solution = render(getProblem(meta.id), seed)

      for (const [label, payload] of Object.entries(payloads)) {
        const text = JSON.stringify(payload)
        const leaked = keysAtEveryDepth(payload).filter((key) => BANNED_KEYS.includes(key))
        expect([label, leaked]).toEqual([label, []])
        expect([label, text.includes(solution.explanation)]).toEqual([label, false])
        expect([label, text.includes(solution.hints[1])]).toEqual([label, false])
      }

      // The scalar scan reads only what is put in front of the child — the prompt and the
      // visual, the hint they bought and the feedback on their miss. Scanning the whole
      // envelope instead would trip over `difficulty`, `stars` and `version`, which are
      // small integers that an answer is entitled to collide with.
      const shown = [
        JSON.stringify({
          prompt: payloads.item.instance.prompt,
          visual: payloads.item.instance.visual,
        }),
        JSON.stringify({
          prompt: payloads.preview.instance.prompt,
          visual: payloads.preview.instance.visual,
        }),
        payloads.hinted.hint,
        payloads.missed.feedback,
      ]

      for (const [index, text] of shown.entries()) {
        if (meta.widget === 'number' || meta.widget === 'column') {
          const standalone = new RegExp(`(^|[^0-9])${solution.answer.value}([^0-9]|$)`)
          expect([index, standalone.test(text)]).toEqual([index, false])
        }
        if (meta.widget === 'fraction') {
          const written = `${solution.answer.num}/${solution.answer.den}`
          expect([index, text.includes(written)]).toEqual([index, false])
        }
      }
    })
  }
)

describe('the word bank never gives the cloze answer away', () => {
  it.each(listProblems().filter((meta) => meta.widget === 'cloze').map((meta) => [meta.id, meta]))(
    '%s offers the word among plain choices only',
    async (_id, meta) => {
      const { seed, payloads } = await walkTheCorridor(meta)
      const solution = render(getProblem(meta.id), seed)
      const word = solution.answer.blanks[0].accept[0]
      const { visual } = payloads.item.instance

      expect(Array.isArray(visual.choices)).toBe(true)
      expect(visual.choices.length).toBeGreaterThan(1)
      for (const choice of visual.choices) expect(typeof choice).toBe('string')
      expect(visual.choices.filter((choice) => choice === word)).toHaveLength(1)
      expect(visual.sentence.toLowerCase()).not.toContain(word.toLowerCase())

      const withoutChoices = JSON.stringify({ ...payloads.item.instance, visual: { ...visual, choices: [] } })
      expect(withoutChoices.toLowerCase()).not.toContain(word.toLowerCase())
    }
  )
})

describe('the options never say which one is right', () => {
  it.each(listProblems().filter((meta) => meta.widget === 'choice').map((meta) => [meta.id, meta]))(
    '%s offers both options as plain, interchangeable labels',
    async (_id, meta) => {
      const { seed, payloads } = await walkTheCorridor(meta)
      const solution = render(getProblem(meta.id), seed)
      const { visual } = payloads.item.instance

      expect(visual.kind).toBe('choice')
      expect(visual.options.length).toBeGreaterThan(1)
      // Every option carries the same keys, so there is no extra field on exactly one of
      // them for a curious kid to read off in the network tab.
      for (const option of visual.options) expect(Object.keys(option).sort()).toEqual(['id', 'label'])
      expect(visual.options.filter((option) => option.id === solution.answer.id)).toHaveLength(1)
      // The answer id appears once — as an option, which is the question itself — and
      // nowhere else in the envelope.
      const elsewhere = JSON.stringify({ ...payloads.item.instance, visual: { ...visual, options: [] } })
      expect(elsewhere).not.toContain(`"${solution.answer.id}"`)
    }
  )
})

describe('the cards never arrive already in order', () => {
  it.each(listProblems().filter((meta) => meta.widget === 'order').map((meta) => [meta.id, meta]))(
    '%s sends four interchangeable cards, shuffled',
    async (_id, meta) => {
      const { seed, payloads } = await walkTheCorridor(meta)
      const solution = render(getProblem(meta.id), seed)
      const { visual } = payloads.item.instance

      expect(visual.kind).toBe('order')
      expect(visual.items.length).toBeGreaterThan(1)
      // Every card carries the same keys, so there is no extra field on the first one for
      // a curious kid to read off in the network tab.
      for (const item of visual.items) expect(Object.keys(item).sort()).toEqual(['id', 'label'])
      // The ids are the answer alphabet, so what must not be on the wire is their order.
      const sent = visual.items.map((item) => item.id)
      expect(sent).not.toEqual(solution.answer.sequence)
      const envelope = JSON.stringify(payloads.item.instance)
      for (const separator of ['", "', '","', ',', ' ', '']) {
        expect(envelope).not.toContain(solution.answer.sequence.join(separator))
      }
      expect(envelope).not.toContain('sequence')
    }
  )
})

describe('two kids in the same grade on the same day', () => {
  it('see the same problem, and score it separately', async () => {
    const meta = listProblems()[0]
    const first = await walkTheCorridor(meta)
    const second = await walkTheCorridor(meta)

    expect(second.seed).toBe(first.seed)
    expect(second.student.id).not.toBe(first.student.id)
    expect(getSessionItem(first.sessionId, meta.id, first.seed).tries).toBe(1)
    expect(getAttemptsBySession(second.sessionId)).toHaveLength(0)
  })
})
