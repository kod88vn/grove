import { describe, expect, it } from '@jest/globals'
import { getModuleBySlug, getModulesByDomain } from './registry'

describe('module registry', () => {
  it('returns known module by slug', () => {
    const module = getModuleBySlug('sudoku')

    expect(module).toBeDefined()
    expect(module.title).toBe('Sudoku')
    expect(module.href).toBe('/modules/sudoku')
  })

  it('returns all household modules for catalog sections', () => {
    const household = getModulesByDomain('household')
    const slugs = household.map((module) => module.slug)

    expect(slugs).toContain('chat')
    expect(slugs).toContain('shopping-list')
    expect(slugs).toContain('document-manager')
  })

  it('returns undefined for unknown slug', () => {
    expect(getModuleBySlug('does-not-exist')).toBeUndefined()
  })
})
