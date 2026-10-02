/** @jest-environment node */
import { afterAll, beforeEach, expect, it } from '@jest/globals'
import { finishSession, getDatabase, initDb, insertSession, insertStudent } from '../../../../../lib/db.js'
import { POST } from './route.js'

const originalResponse = global.Response
beforeEach(() => {
  initDb(':memory:')
  insertStudent({ id: 'kid-race', display_name: 'Race', avatar: '🦊', grade: 5, settings: {} })
  insertSession({ id: 'racing-session', student_id: 'kid-race', kind: 'skill', skill_id: 'm5.oa.order-of-operations', local_date: '2026-10-02', tz: 'UTC' })
  global.Response = class {
    static json(value, init = {}) { return { status: init.status ?? 200, json: async () => value } }
  }
})
afterAll(() => { global.Response = originalResponse })

it('rejects an item whose request body arrives after the session was finished, without inserting it', async () => {
  let releaseBody
  let signalReading
  const reading = new Promise((resolve) => { signalReading = resolve })
  const pending = POST({ json: async () => { signalReading(); return new Promise((resolve) => { releaseBody = resolve }) } }, { params: Promise.resolve({ id: 'racing-session' }) })
  await reading
  finishSession('racing-session', { finished: true, stars: 0, grew: [] })
  releaseBody({ problemId: 'm5.oa.order-of-operations/precedence' })
  const response = await pending
  expect(response.status).toBe(409)
  expect(getDatabase().prepare('SELECT COUNT(*) AS count FROM session_items WHERE session_id = ?').get('racing-session').count).toBe(0)
})
