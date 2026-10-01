import { describe, expect, it } from '@jest/globals'
import { emptyValue, toResponse } from './response'

const instance = {
  widget: 'table-fill',
  visual: { kind: 'table-fill', rows: [{ id: 'row-a' }, { id: 'row-b' }] },
}

describe('table-fill response values', () => {
  it('starts with a separate empty string for each issued cell', () => {
    expect(emptyValue(instance)).toEqual({ 'row-a': '', 'row-b': '' })
  })

  it('submits the controlled per-cell values under the cells key', () => {
    const value = { 'row-a': '300', 'row-b': '125' }
    expect(toResponse(instance, value)).toEqual({ cells: value })
  })
})