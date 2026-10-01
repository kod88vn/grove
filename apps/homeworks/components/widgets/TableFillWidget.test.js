import { fireEvent, render, screen, within } from '@testing-library/react'
import '@testing-library/jest-dom'
import { useState } from 'react'
import { check, getProblem, listProblems, render as renderProblem, toInstance } from '@grove/curriculum'
import { gallerySamples, correctValueFor, wrongValueFor } from '@/app/dev/widgets/samples'
import { AnswerWidget } from './AnswerWidget'
import { emptyValue, toResponse } from './response'

const ID = 'm5.md.metric-units/convert-meters-to-centimeters'

function Harness({ instance, result, disabled = false }) {
  const [value, setValue] = useState(() => emptyValue(instance))
  result.value = value
  return <AnswerWidget instance={instance} value={value} onChange={setValue} disabled={disabled} />
}

test('the Grade 5 measurement sample is registered and appears in the real gallery', () => {
  expect(listProblems().filter(({ id }) => id === ID)).toEqual([
    expect.objectContaining({ id: ID, skill: 'm5.md.metric-units', grade: 5, widget: 'table-fill' }),
  ])
  const sample = gallerySamples().find(({ widget }) => widget === 'table-fill')
  expect(sample).toBeDefined()
  expect(sample.problemId).toBe(ID)
  expect(sample.instance).toEqual(toInstance(renderProblem(getProblem(ID), 2505)))
  expect(check(sample.widget, sample.answer, toResponse(sample.instance, correctValueFor(sample)))).toEqual({ correct: true, reason: null })
  expect(check(sample.widget, sample.answer, toResponse(sample.instance, wrongValueFor(sample)))).toEqual({ correct: false, reason: 'wrong' })
})

test('500 seeds issue distinct, independently checkable unit-conversion cells without exposing answers', () => {
  const seen = new Set()
  for (let seed = 1; seed <= 500; seed++) {
    const full = renderProblem(getProblem(ID), seed)
    const publicItem = toInstance(full)
    expect(publicItem.visual.kind).toBe('table-fill')
    expect(publicItem.visual.rows).toHaveLength(4)
    expect(publicItem.visual.rows.map(({ meters }) => meters)).toEqual(expect.arrayContaining([expect.any(Number)]))
    const ids = publicItem.visual.rows.map(({ id }) => id)
    expect(new Set(ids).size).toBe(4)
    expect(new Set(publicItem.visual.rows.map(({ meters }) => meters)).size).toBe(4)
    expect(Object.keys(full.answer.cells).sort()).toEqual([...ids].sort())
    expect(Object.keys(publicItem)).not.toContain('answer')
    expect(JSON.stringify(publicItem)).not.toMatch(/"answer"|"cells"|"explanation"/)
    for (const { id, meters } of publicItem.visual.rows) {
      expect(Number.isInteger(meters) && meters > 0).toBe(true)
      expect(full.answer.cells[id]).toBe(meters * 100)
    }
    const correct = Object.fromEntries(publicItem.visual.rows.map(({ id, meters }) => [id, String(meters * 100)]))
    expect(check('table-fill', full.answer, { cells: correct })).toEqual({ correct: true, reason: null })
    const wrong = { ...correct, [ids[0]]: String(full.answer.cells[ids[0]] + 100) }
    expect(check('table-fill', full.answer, { cells: wrong })).toEqual({ correct: false, reason: 'wrong' })
    expect(check('table-fill', full.answer, { cells: { ...correct, [ids[0]]: '' } })).toEqual({ correct: false, reason: 'invalid' })
    seen.add(JSON.stringify(publicItem.visual.rows.map(({ meters }) => meters)))
  }
  expect(seen.size).toBeGreaterThan(100)
})

test('checker rejects malformed author keys and incomplete or foreign child cells', () => {
  const item = renderProblem(getProblem(ID), 42)
  const response = { cells: Object.fromEntries(Object.entries(item.answer.cells).map(([id, number]) => [id, String(number)])) }
  expect(() => check('table-fill', { cells: { a: Infinity } }, response)).toThrow(TypeError)
  expect(() => check('table-fill', { cells: {} }, response)).toThrow(TypeError)
  expect(check('table-fill', item.answer, { cells: { ...response.cells, extra: '1' } })).toEqual({ correct: false, reason: 'invalid' })
  expect(check('table-fill', item.answer, { cells: {} })).toEqual({ correct: false, reason: 'invalid' })
  expect(check('table-fill', item.answer, { cells: { ...response.cells, [Object.keys(response.cells)[0]]: 'hello' } })).toEqual({ correct: false, reason: 'invalid' })
})

test.each([1, 7, 42])('a child can fill, revise, and grade all cells through the real widget at seed %s', (seed) => {
  const full = renderProblem(getProblem(ID), seed)
  const instance = toInstance(full)
  const result = {}
  const view = render(<Harness instance={instance} result={result} />)
  const cells = instance.visual.rows.map(({ id }) => screen.getByRole('textbox', { name: new RegExp(`centimeters.*${id}`, 'i') }))
  expect(cells).toHaveLength(4)
  expect(view.container.textContent).toContain(instance.prompt)
  expect(view.container.textContent).not.toContain(full.explanation)
  expect(screen.queryByLabelText('Your answer')).toBeNull()
  expect(check('table-fill', full.answer, toResponse(instance, result.value))).toEqual({ correct: false, reason: 'invalid' })
  cells.forEach((cell, index) => {
    const { id, meters } = instance.visual.rows[index]
    expect(cell).toHaveAccessibleName(expect.stringContaining(String(meters)))
    expect(cell.className).toMatch(/min-h-\[56px\]/)
    fireEvent.change(cell, { target: { value: String(meters * 100) } })
    expect(toResponse(instance, result.value).cells[id]).toBe(String(meters * 100))
  })
  expect(check('table-fill', full.answer, toResponse(instance, result.value))).toEqual({ correct: true, reason: null })
  fireEvent.change(cells[0], { target: { value: String(full.answer.cells[instance.visual.rows[0].id] + 100) } })
  expect(check('table-fill', full.answer, toResponse(instance, result.value))).toEqual({ correct: false, reason: 'wrong' })
  expect(within(view.container).getAllByRole('textbox')).toHaveLength(4)
})

test('disabled table cells cannot change their submitted value', () => {
  const instance = toInstance(renderProblem(getProblem(ID), 11))
  const result = {}
  render(<Harness instance={instance} result={result} disabled />)
  const before = toResponse(instance, result.value)
  for (const cell of screen.getAllByRole('textbox')) {
    expect(cell).toBeDisabled()
    fireEvent.change(cell, { target: { value: '900' } })
  }
  expect(toResponse(instance, result.value)).toEqual(before)
})