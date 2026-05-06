import { describe, expect, it } from '@jest/globals'
import { getModuleBySlug, getModulesByDomain } from './registry'

describe('module registry', () => {
  it('returns known module by slug', () => {
    const module = getModuleBySlug('gomoku')

    expect(module).toBeDefined()
    expect(module.title).toBe('Gomoku')
    expect(module.href).toBe('/modules/gomoku')
  })

  it('returns all household modules for catalog sections', () => {
    const household = getModulesByDomain('household')
    const slugs = household.map((module) => module.slug)

    expect(slugs).toContain('chat')
    expect(slugs).toContain('shopping-list')
    expect(slugs).toContain('document-manager')
  })

  it('includes four educational games', () => {
    const learning = getModulesByDomain('learning')
    const slugs = learning.map((module) => module.slug)

    expect(slugs).toEqual(expect.arrayContaining(['crossword', 'hangman', 'sudoku', 'gomoku']))
  })

  it('returns undefined for unknown slug', () => {
    expect(getModuleBySlug('does-not-exist')).toBeUndefined()
  })
})
