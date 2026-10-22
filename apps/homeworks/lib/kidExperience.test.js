/** @jest-environment node */
// U04: observable kid-experience contract over dates, per-kid attempts, and public Daily Seed.
// The module is deliberately absent on the base branch: this must be RED before implementation.
import { afterAll, beforeEach, describe, expect, it } from '@jest/globals'
import { initDb, insertStudent, getStudentById } from './db.js'
import { listProblems } from '@grove/curriculum'
import { dailySeed, wateringSummary, rewardSummary, questList, gardenSummary } from './kidExperience.js'
import { GET as getDaily } from '../app/api/daily/route.js'

const originalResponse = global.Response
if (!global.Response?.json) {
  global.Response = class {
    static json(value, init = {}) {
      return { status: init.status ?? 200, json: async () => value }
    }
  }
}

beforeEach(() => {
  initDb(':memory:')
  insertStudent({ id: 'sibling-1', display_name: 'Mina', avatar: '🦊', grade: 5, settings: {} })
  insertStudent({ id: 'sibling-2', display_name: 'Theo', avatar: '🐻', grade: 5, settings: {} })
})
afterAll(() => { global.Response = originalResponse })

const attempt = (student_id, local_date, stars, extras = {}) => ({
  student_id, local_date, stars, correct: stars > 0 ? 1 : 0, revealed: 0,
  skill_id: 'm5.oa.order-of-operations', difficulty: 1, ...extras,
})

async function daily(grade, date) {
  const response = await getDaily({ url: `http://localhost:3005/homeworks/api/daily?grade=${grade}&date=${date}` })
  return { status: response.status, body: await response.json() }
}

describe('U04 daily challenge and per-kid rewards', () => {
  it('uses only grade and the local calendar date for the shared Daily Seed, not student identity or UTC', async () => {
    expect(getStudentById('sibling-1').grade).toBe(getStudentById('sibling-2').grade)
    const same = dailySeed({ grade: 5, localDate: '2026-09-30' })
    expect(same).toBe(dailySeed({ grade: 5, localDate: '2026-09-30' }))
    expect(same).not.toBe(dailySeed({ grade: 5, localDate: '2026-10-01' }))
    expect(same).not.toBe(dailySeed({ grade: 4, localDate: '2026-09-30' }))
    expect(Number.isInteger(same)).toBe(true)
    expect(same).toBeGreaterThanOrEqual(0)
    expect(same).toBeLessThanOrEqual(2147483647)
  })

  it('serves one real registered challenge for a grade/date, never its answer or a client-selected seed', async () => {
    const first = await daily(5, '2026-09-30')
    const again = await daily(5, '2026-09-30')
    expect(first.status).toBe(200)
    expect(first.body).toEqual(again.body)
    expect(first.body.problemId).toEqual(expect.any(String))
    expect(first.body.seed).toBe(dailySeed({ grade: 5, localDate: '2026-09-30' }))
    expect(first.body.instance).toEqual(expect.objectContaining({ prompt: expect.anything() }))
    expect(first.body.instance).not.toHaveProperty('answer')
    expect((await daily(5, '2026-10-01')).body.seed).not.toBe(first.body.seed)
    const injected = await getDaily({ url: 'http://localhost:3005/homeworks/api/daily?grade=5&date=2026-09-30&seed=42' })
    expect(injected.status).toBe(400)
  })

  it('counts each watered day once, freezes at most two missed days per Monday–Sunday week, and sets a five-day weekly goal', () => {
    const five = ['2026-09-21', '2026-09-24', '2026-09-25', '2026-09-26', '2026-09-27']
    const attempts = [...five.map((day) => attempt('sibling-1', day, 2)), attempt('sibling-1', '2026-09-24', 3), attempt('sibling-2', '2026-09-22', 3), attempt('sibling-1', '2026-09-23', 0, { revealed: 1 })]
    const summary = wateringSummary({ attempts, studentId: 'sibling-1', today: '2026-09-27' })
    expect(summary.wateredDays).toBe(5)
    expect(summary.rainDaysUsed).toBe(2)
    expect(summary.streak).toBe(7)
    expect(summary.weeklyGoalMet).toBe(true)
    const thirdGap = attempts.filter((row) => row.local_date !== '2026-09-26')
    expect(wateringSummary({ attempts: thirdGap, studentId: 'sibling-1', today: '2026-09-27' }).streak).toBe(1)
  })

  it('awards only persisted stars for the selected child, excluding revealed or incorrect attempts', () => {
    const attempts = [attempt('sibling-1', '2026-09-27', 3), attempt('sibling-1', '2026-09-27', 2), attempt('sibling-1', '2026-09-27', 0, { revealed: 1 }), attempt('sibling-2', '2026-09-27', 3)]
    const summary = rewardSummary({ attempts, studentId: 'sibling-1' })
    expect(summary.sunshine).toBe(5)
    expect(summary.stars).toBe(5)
    expect(rewardSummary({ attempts, studentId: 'sibling-2' }).sunshine).toBe(3)
  })

  it('filters actual catalog candidates by grade, topic, difficulty and attempted status before choosing a quest', () => {
    const problems = [
      { id: 'grade-5-fractions', grade: 5, skillId: 'm5.nf', subject: 'math', difficulty: 2 },
      { id: 'grade-5-geometry', grade: 5, skillId: 'm5.g', subject: 'math', difficulty: 1 },
      { id: 'grade-6-fractions', grade: 6, skillId: 'm6.nf', subject: 'math', difficulty: 2 },
    ]
    expect(questList({ problems, grade: 5, topic: 'm5.nf', difficulty: 2, status: 'untried', studentId: 'sibling-1', attempts: [] }).map(({ id }) => id)).toEqual(['grade-5-fractions'])
    expect(questList({ problems, grade: 5, topic: 'm5.nf', difficulty: 2, status: 'untried', studentId: 'sibling-1', attempts: [attempt('sibling-1', '2026-09-27', 1, { problem_id: 'grade-5-fractions' })] })).toEqual([])
  })

  it('does not fake mastery or a fruiting tree just because a child earned stars', () => {
    const skills = [{ id: 'm5.oa.order-of-operations' }, { id: 'm5.nf.add-fractions' }]
    const garden = gardenSummary({ skills, attempts: [attempt('sibling-1', '2026-09-27', 3)], studentId: 'sibling-1' })
    expect(garden.find(({ skillId }) => skillId === 'm5.oa.order-of-operations').stage).toBe('sprout')
    expect(garden.find(({ skillId }) => skillId === 'm5.nf.add-fractions').stage).toBe('seed')
    expect(garden.every(({ stage }) => stage !== 'tree' && stage !== 'fruiting')).toBe(true)
  })

  it('never seeds a boss into the Daily Seed: a full month of picks stays boss-free', async () => {
    const bossIds = new Set(listProblems({ grade: 5 }).filter((problem) => problem.boss).map((problem) => problem.id))
    expect(bossIds.size).toBeGreaterThan(0)
    for (let day = 1; day <= 31; day += 1) {
      const { status, body } = await daily(5, `2026-10-${String(day).padStart(2, '0')}`)
      expect(status).toBe(200)
      expect(bossIds.has(body.problemId)).toBe(false)
    }
  })

  it('keeps bosses out of the quest board even when the board lists the boss skill', () => {
    const problems = [
      { id: 'm5.nf.add-fractions-unlike/multiple-denominators', grade: 5, skillId: 'm5.nf.add-fractions-unlike', difficulty: 1 },
      { id: 'm5.nf.add-fractions-unlike/fraction-boss', grade: 5, skillId: 'm5.nf.add-fractions-unlike', difficulty: 3, boss: true },
    ]
    expect(questList({ problems, grade: 5, studentId: 'sibling-1', attempts: [] }).map(({ id }) => id))
      .toEqual(['m5.nf.add-fractions-unlike/multiple-denominators'])
  })
})
