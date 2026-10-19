import { describe, expect, it } from '@jest/globals'
import * as presentation from './kidExperiencePresentation.js'
import { continueHref, gardenStagePresentation } from './kidExperiencePresentation.js'

describe('kid experience presentation', () => {
  it('labels each evidenced garden stage for young readers', () => {
    expect(['seed', 'sprout', 'sapling', 'tree', 'fruiting'].map(gardenStagePresentation)).toEqual([
      { icon: '🌰', label: 'Seed — ready to begin' },
      { icon: '🌱', label: 'Sprout — you tried this skill' },
      { icon: '🌿', label: 'Sapling — growing with practice' },
      { icon: '🌳', label: 'Tree — strong across practice days' },
      { icon: '🍎', label: 'Fruiting — spaced review complete' },
    ])
  })

  it('builds Continue from the existing session, problem, skill, and selected child', () => {
    expect(continueHref({
      sessionId: 'open-session', skillId: 'm5.oa.order-of-operations',
      problemId: 'm5.oa.order-of-operations/precedence',
    }, 'kid-a')).toBe('/play/open-session?skill=m5.oa.order-of-operations&problemId=m5.oa.order-of-operations%2Fprecedence&count=1&studentId=kid-a')
  })

  it('leaves path and boss selection to the Phase 4 mastery experience', () => {
    expect(Object.keys(presentation)).not.toContain('bossForPath')
  })
})
