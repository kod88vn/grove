/**
 * P2.10 part 1b of 2 — the `clock` sample problem.
 *
 * HOMEWORK_PLAN.md §6.3 (line 191), quoted whole:
 *
 *   | `clock` | telling time | hh:mm equality | A |
 *
 * WHY THIS SKILL, AND WHY IT IS OFF-GRADE. `HOMEWORK_PROGRESS.md` gives a three-branch rule
 * for choosing a sample problem: (1) a Grade 5 skill already in the catalog whose §7/§8
 * widget list names the widget; (2) failing that, an off-grade template tagged the way §7
 * tags off-grade Grade 5 skills — "keep them, tag `ccss: []`, and note it in the catalog" —
 * and added to `grade-05.offgrade.test.js`'s `OFF_GRADE` so the note travels with it;
 * (3) never an invented fixture.
 *
 * Branch 1 fails, and for a reason rather than for want of looking. Telling time is a Grade
 * 1–3 skill; the Grade 5 measurement standard is 5.MD.A.1, "convert among different-sized
 * standard measurement units within a given measurement system", which this catalog cites
 * on `m5.md.customary-units` and `m5.md.metric-units` — length, weight, mass and volume,
 * never time. The only time skill in the Grade 5 catalog is `m5.md.time-money`, which has
 * carried `ccss: []` since P1.3 precisely because it is off-grade.
 *
 * So branch 2, using a skill that ALREADY EXISTS — no new skill, no invented CCSS code.
 * `grade-05.test.js` pins `skills.length === 55` and that count does not move. What this row
 * adds is the note §7 asks for, beside the skill, forced by `grade-05.offgrade.test.js`.
 *
 * THE TASK. Elapsed time, which is the plan's own Grade 3 consumer of this widget
 * (line 370, `time-elapsed`), and the one time task that is arithmetic rather than recall.
 * The hands start at the time the problem starts; the child counts on by a stated duration
 * and moves them to the time it ends.
 *
 *   visual  = { kind: 'clock', start: { hour: 1..12, minute: 5..55 step 5 } }
 *   answer  = { hour: 1..12, minute: 0..55 step 5 }
 *   prompt  = the duration, in whole hours and minutes, and the instruction to move the hands
 *
 * FIVE-MINUTE GRID. §6.3 grades this widget by `hh:mm equality`, an exact comparison, so
 * hand positions must quantise. The plan's three consumers of `clock` are `time-hour-half`
 * (line 353), `time-5-minutes` (line 361) and `time-elapsed` (line 370): five minutes is the
 * finest it ever asks for, and it is the grid both input paths — drag and keyboard stepper —
 * can reach every position of. Every time this template produces sits on it.
 *
 * BOTH HANDS ALWAYS MOVE. The duration is at least 65 minutes and never a whole number of
 * hours, so the end time differs from the start in BOTH hour and minute. Three things fall
 * out of that, and each is pinned below:
 *
 *   - an untouched widget is never correct, because the hands start at `start`;
 *   - a child who moved only the hour hand, or only the minute hand, is never correct;
 *   - the start time on the face can never be mistaken for a hint at the answer.
 *
 * THE START IS ON THE FACE, NOT IN THE PROMPT. Printing it too would make the clock
 * decorative and give two copies of one fact to keep in agreement. Reading the start off the
 * hands is part of the exercise; the widget's accessible name announces the set time
 * continuously (`ClockWidget.test.js`), so nobody is shut out.
 *
 * THE END TIME NEVER TRAVELS. `toInstance()` strips `answer`; the tests below additionally
 * refuse any `hh:mm` text in the prompt or the hints, and pin `visual` to exactly the two
 * keys the face needs. `toInstance()`'s allowlist gains `clock` in `index.api.test.js` in
 * the same commit.
 *
 * THE EXPLANATION MUST SHOW THE WORKING. P2.9's referee found an explanation that simply
 * read the answer back. Here the equivalent failure is "The film ends at 4:20." — true,
 * useless, and indistinguishable from the answer key. The assertion below is procedural:
 * the times in the explanation must run start → the next o'clock → the end, in that order,
 * so the explanation has to walk the count-on method rather than announce the result.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { check, getProblem, getSkill, listProblems, render, toInstance } from '../../../index.js'
import { templates } from './clock-elapsed-time.js'

const ID = 'm5.md.time-money/clock-elapsed-time'
const SKILL = 'm5.md.time-money'
const SEEDS = [1, 2, 7, 42, 12_345, 999_999]
const SWEEP = Array.from({ length: 400 }, (unused, index) => index + 1)

const STEP = 5
const MIN_DURATION = 65
const MAX_DURATION = 175
const HALF_DAY = 12 * 60

/** `H:MM`, the way a clock is written and the way the explanation must write it. */
const fmt = (time) => `${time.hour}:${String(time.minute).padStart(2, '0')}`

/** Minutes past 12:00 on a twelve-hour face. */
const minutesOf = (time) => (time.hour % 12) * 60 + time.minute

/** The inverse: minutes past 12:00 back to a reading, with 0 written as 12. */
const timeAt = (minutes) => {
  const wrapped = ((minutes % HALF_DAY) + HALF_DAY) % HALF_DAY
  const hour = Math.floor(wrapped / 60)
  return { hour: hour === 0 ? 12 : hour, minute: wrapped % 60 }
}

/**
 * The independent oracle: read the duration out of the prompt the child is given, count it
 * on from the time the face shows, and that is the answer. Nothing here imports the
 * generator's arithmetic — it re-derives the end time from the two things that ship.
 */
function durationFromPrompt(prompt) {
  const hours = prompt.match(/(\d+)\s+hours?\b/g)
  const minutes = prompt.match(/(\d+)\s+minutes?\b/g)
  assert.ok(hours && hours.length === 1, `prompt must state the hours exactly once: ${prompt}`)
  assert.ok(minutes && minutes.length === 1, `prompt must state the minutes exactly once: ${prompt}`)
  return Number.parseInt(hours[0], 10) * 60 + Number.parseInt(minutes[0], 10)
}

const oracleEnd = (start, duration) => timeAt(minutesOf(start) + duration)

const isReadable = (time) =>
  Number.isInteger(time.hour) && time.hour >= 1 && time.hour <= 12 &&
  Number.isInteger(time.minute) && time.minute >= 0 && time.minute < 60

const share = (count) => count / SWEEP.length

test('the template is registered as a `clock` problem on the off-grade time skill', () => {
  assert.equal(templates.length, 1)
  const [template] = templates
  assert.equal(template.id, ID)
  assert.equal(template.skill, SKILL)
  assert.equal(template.widget, 'clock')
  assert.equal(template.version, 1)
  assert.ok(template.difficulty >= 1 && template.difficulty <= 3)
  assert.ok(typeof template.title === 'string' && template.title.length > 0)

  assert.ok(getProblem(ID), 'getProblem() does not know about the clock template')
  assert.ok(listProblems().some((problem) => problem.id === ID), 'listProblems() omits it')
  assert.equal(listProblems().find((problem) => problem.id === ID).widget, 'clock')
})

test('the skill it hangs on is the existing, untagged, off-grade time skill', () => {
  const skill = getSkill(SKILL)
  assert.ok(skill, `${SKILL} is not in the catalog`)
  assert.equal(skill.grade, 5)
  assert.equal(skill.strand, 'md')
  assert.equal(skill.legacyId, 'time-money')
  // Off-grade, per §7. No CCSS code may be invented to make telling the time look like a
  // Grade 5 standard; `grade-05.offgrade.test.js` forces the note that says why.
  assert.deepEqual(skill.ccss, [])
})

test('the face is a clock showing a start time, and carries nothing else', () => {
  for (const seed of SEEDS) {
    const { visual, widget } = render(getProblem(ID), seed)
    assert.equal(widget, 'clock')
    assert.deepEqual(Object.keys(visual).sort(), ['kind', 'start'], `seed ${seed}`)
    assert.equal(visual.kind, 'clock')
    assert.deepEqual(Object.keys(visual.start).sort(), ['hour', 'minute'], `seed ${seed}`)
    assert.ok(isReadable(visual.start), `seed ${seed}: ${JSON.stringify(visual.start)}`)
  }
})

test('every start and every answer sits on the five-minute grid the hands can reach', () => {
  for (const seed of SWEEP) {
    const { visual, answer } = render(getProblem(ID), seed)
    assert.equal(visual.start.minute % STEP, 0, `seed ${seed} start`)
    assert.equal(answer.minute % STEP, 0, `seed ${seed} answer`)
    assert.ok(isReadable(answer), `seed ${seed}: ${JSON.stringify(answer)}`)
    // The start is never on the hour, so "count on to the next o'clock" is always a real
    // step and the explanation always has a distinct middle time to show.
    assert.ok(visual.start.minute >= STEP, `seed ${seed}: start is on the hour`)
  }
})

test('the answer is what an independent reader gets by counting the prompt on from the face', () => {
  for (const seed of SWEEP) {
    const { prompt, visual, answer } = render(getProblem(ID), seed)
    const duration = durationFromPrompt(prompt)
    assert.ok(
      duration >= MIN_DURATION && duration <= MAX_DURATION,
      `seed ${seed}: duration ${duration} is outside ${MIN_DURATION}..${MAX_DURATION}`,
    )
    assert.equal(duration % STEP, 0, `seed ${seed}: duration ${duration} is off the grid`)
    assert.notEqual(duration % 60, 0, `seed ${seed}: a whole number of hours moves one hand only`)
    assert.deepEqual(answer, oracleEnd(visual.start, duration), `seed ${seed}`)
  }
})

test('both hands always have to move, so no untouched or half-moved clock is ever correct', () => {
  for (const seed of SWEEP) {
    const { visual, answer } = render(getProblem(ID), seed)
    const { start } = visual
    assert.notEqual(answer.hour, start.hour, `seed ${seed}: the hour hand never moves`)
    assert.notEqual(answer.minute, start.minute, `seed ${seed}: the minute hand never moves`)

    // The three readings a child gets for free, none of which may be graded correct.
    assert.deepEqual(check('clock', answer, { ...start }), { correct: false, reason: 'wrong' })
    assert.deepEqual(
      check('clock', answer, { hour: answer.hour, minute: start.minute }),
      { correct: false, reason: 'wrong' },
      `seed ${seed}: minute hand left behind`,
    )
    assert.deepEqual(
      check('clock', answer, { hour: start.hour, minute: answer.minute }),
      { correct: false, reason: 'wrong' },
      `seed ${seed}: hour hand left behind`,
    )
  }
})

test('the shipped checker agrees, three ways, on every problem', () => {
  for (const seed of SWEEP) {
    const { answer } = render(getProblem(ID), seed)
    assert.deepEqual(check('clock', answer, { ...answer }), { correct: true, reason: null }, `seed ${seed}`)
    assert.deepEqual(
      check('clock', answer, { hour: answer.hour, minute: (answer.minute + STEP) % 60 }),
      { correct: false, reason: 'wrong' },
      `seed ${seed}`,
    )
    assert.deepEqual(
      check('clock', answer, { hour: 0, minute: answer.minute }),
      { correct: false, reason: 'invalid' },
      `seed ${seed}`,
    )
  }
})

test('the end time is nowhere in what the child is given', () => {
  for (const seed of SWEEP) {
    const rendered = render(getProblem(ID), seed)
    const instance = toInstance(rendered)

    assert.equal(instance.answer, undefined)
    assert.equal(instance.explanation, undefined)
    assert.equal(instance.hints, undefined)
    assert.deepEqual(instance.visual, rendered.visual)

    // A clock time is written with a colon. None may appear in anything shipped before the
    // attempt — not the end time, and not the start time in text either, since the face is
    // where the start is read from.
    const shipped = `${instance.prompt} ${JSON.stringify(instance.visual)}`
    assert.equal(shipped.match(/\d{1,2}:\d{2}/g), null, `seed ${seed}: ${shipped}`)
    assert.ok(!JSON.stringify(instance).includes(fmt(rendered.answer)), `seed ${seed}`)
  }
})

test('the prompt says what to do with the hands and gives the duration, once', () => {
  const prompts = new Set()
  for (const seed of SWEEP) {
    const { prompt } = render(getProblem(ID), seed)
    assert.ok(typeof prompt === 'string' && prompt.length > 0)
    assert.match(prompt, /hands/i, `seed ${seed}: the child is not told to move the hands`)
    durationFromPrompt(prompt)
    prompts.add(prompt)
  }
  // Not one sentence with one duration in it. The wording may repeat; the problem may not.
  assert.ok(prompts.size >= 20, `only ${prompts.size} distinct prompts across ${SWEEP.length} seeds`)
})

test('the hints teach the method and are the same on every problem, so they cannot leak', () => {
  const first = render(getProblem(ID), SEEDS[0]).hints
  assert.ok(Array.isArray(first) && first.length >= 2, 'at least two hints')
  for (const seed of SWEEP) {
    const { hints } = render(getProblem(ID), seed)
    // Seed-independent by construction: a hint that never changes cannot carry this
    // problem's answer, whatever it says.
    assert.deepEqual(hints, first, `seed ${seed}`)
  }
  for (const hint of first) {
    assert.equal(hint.match(/\d{1,2}:\d{2}/g), null, `a hint states a time: ${hint}`)
  }
})

test('the explanation walks the count-on, it does not announce the answer', () => {
  for (const seed of SWEEP) {
    const { visual, answer, explanation } = render(getProblem(ID), seed)
    const nextOClock = timeAt((Math.floor(minutesOf(visual.start) / 60) + 1) * 60)
    const times = explanation.match(/\d{1,2}:\d{2}/g) ?? []

    assert.ok(times.length >= 3, `seed ${seed}: only ${times.length} times in "${explanation}"`)
    assert.equal(times[0], fmt(visual.start), `seed ${seed}: does not start from the face`)
    assert.equal(times[1], fmt(nextOClock), `seed ${seed}: does not count on to the next o'clock`)
    assert.equal(times.at(-1), fmt(answer), `seed ${seed}: does not end at the answer`)
  }
})

test('the problems vary — hours, minutes, durations, and crossings of twelve', () => {
  const startHours = new Set()
  const startMinutes = new Set()
  const durations = new Set()
  let crossings = 0

  for (const seed of SWEEP) {
    const { prompt, visual } = render(getProblem(ID), seed)
    const duration = durationFromPrompt(prompt)
    startHours.add(visual.start.hour)
    startMinutes.add(visual.start.minute)
    durations.add(duration)
    if (minutesOf(visual.start) + duration >= HALF_DAY) crossings += 1
  }

  assert.ok(startHours.size >= 10, `only ${startHours.size} start hours`)
  assert.ok(startMinutes.size >= 8, `only ${startMinutes.size} start minutes`)
  assert.ok(durations.size >= 12, `only ${durations.size} durations`)
  // Counting past twelve is the case that catches a generator doing plain addition. It has
  // to happen, and it has to not be the only thing that happens.
  assert.ok(
    share(crossings) >= 0.02 && share(crossings) <= 0.5,
    `${crossings}/${SWEEP.length} problems cross twelve`,
  )
})

test('a seed is a problem: the same seed renders identically, different seeds do not', () => {
  for (const seed of SEEDS) {
    assert.deepEqual(render(getProblem(ID), seed), render(getProblem(ID), seed), `seed ${seed}`)
  }
  const distinct = new Set(SWEEP.map((seed) => JSON.stringify(render(getProblem(ID), seed))))
  assert.ok(distinct.size >= 100, `only ${distinct.size} distinct problems across ${SWEEP.length} seeds`)
})
