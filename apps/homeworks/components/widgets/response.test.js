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

describe('symbolic response values', () => {
  it('starts expressions empty and posts them as text', () => {
    const instance = { widget: 'expression', visual: { kind: 'expression' } }
    expect(emptyValue(instance)).toBe('')
    expect(toResponse(instance, '(x-2)*(x+2)')).toEqual({ text: '(x-2)*(x+2)' })
  })

  it('starts one empty value per ordered step and posts positions unchanged', () => {
    const instance = { widget: 'steps', visual: { items: [{ id: 'one' }, { id: 'two' }] } }
    const value = emptyValue(instance)
    expect(value).toEqual(['', ''])
    expect(toResponse(instance, ['5', '5*3'])).toEqual({ steps: ['5', '5*3'] })
  })
})

describe('graph response values', () => {
  const instance = { widget: 'graph', visual: { kind: 'graph' } }

  it('starts with no plotted points and posts points as the graph response', () => {
    const value = [{ x: 2, y: 3 }]
    expect(emptyValue(instance)).toEqual([])
    expect(toResponse(instance, value)).toEqual({ points: value })
  })
})