/**
 * P1.1: apps/homeworks can import @grove/curriculum by name.
 *
 * Homeworks server routes will generate and check problems through the package
 * (HOMEWORK_PLAN.md §6.1), so the name must resolve from here, through jest, to the
 * package's declared entry, the same way @grove/shell does.
 */
import { describe, expect, it } from '@jest/globals'
import { readFileSync, realpathSync } from 'node:fs'
import path from 'node:path'

import * as curriculum from '@grove/curriculum'

const PACKAGE_ENTRY = path.resolve(__dirname, '../../../packages/curriculum/src/index.js')

describe('@grove/curriculum from apps/homeworks', () => {
  it('resolves by name to packages/curriculum/src/index.js', () => {
    expect(realpathSync(require.resolve('@grove/curriculum'))).toBe(realpathSync(PACKAGE_ENTRY))
  })

  it('is a workspace dependency of @grove/homeworks', () => {
    const pkg = JSON.parse(readFileSync(path.resolve(__dirname, '../package.json'), 'utf8'))
    expect(pkg.dependencies['@grove/curriculum']).toBe('*')
  })

  it('loads as a module', () => {
    expect(typeof curriculum).toBe('object')
  })
})
