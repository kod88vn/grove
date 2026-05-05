import { describe, expect, it } from '@jest/globals'
import { buildHomeDashboardData } from './dashboard'

describe('buildHomeDashboardData', () => {
  it('derives interests from recent chat titles', () => {
    const data = buildHomeDashboardData({
      now: new Date('2026-05-05T09:00:00'),
      user: {
        login: 'alex@example.com',
        name: 'Alex Example',
        pic: null,
      },
      recentChats: [
        { title: 'School pickup and camp forms' },
        { title: 'Dinner plan and grocery list' },
      ],
    })

    expect(data.greeting).toBe('Good morning')
    expect(data.profile.interests).toContain('school logistics')
    expect(data.profile.interests).toContain('meal planning')
    expect(data.brief[0].title).toBe('School pickup and camp forms')
    expect(data.shoppingList).toEqual([])
    expect(data.reminders).toEqual([])
    expect(data.weather).toBeNull()
  })

  it('stays empty when chat history is empty', () => {
    const data = buildHomeDashboardData({
      now: new Date('2026-05-05T20:00:00'),
      user: {
        login: 'anonymous',
        name: 'Guest',
        pic: null,
      },
      recentChats: [],
    })

    expect(data.greeting).toBe('Good evening')
    expect(data.profile.interests).toEqual([])
    expect(data.brief).toEqual([])
    expect(data.shoppingList).toEqual([])
    expect(data.reminders).toEqual([])
    expect(data.weather).toBeNull()
  })
})