import { fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { useState } from 'react'
import { check, getProblem, listProblems, render as renderProblem, toInstance } from '@grove/curriculum'
import { gallerySamples, correctValueFor, wrongValueFor } from '@/app/dev/widgets/samples'
import { keysFor } from '../MathKeypad'
import { AnswerWidget } from './AnswerWidget'
import { emptyValue, toResponse } from './response'

const correct = { correct: true, reason: null }
const wrong = { correct: false, reason: 'wrong' }
const invalid = { correct: false, reason: 'invalid' }

function Harness({ instance, result, disabled = false }) {
  const [value, setValue] = useState(() => emptyValue(instance))
  result.value = value
  return <AnswerWidget instance={instance} value={value} onChange={setValue} disabled={disabled} />
}

function sampleFor(widget) {
  const problems = listProblems().filter((problem) => problem.widget === widget)
  expect(problems.length).toBeGreaterThan(0)
  expect(problems[0].grade).toBe(5)
  const sample = gallerySamples().find((entry) => entry.widget === widget)
  expect(sample).toBeDefined()
  expect(sample.instance).toEqual(toInstance(renderProblem(getProblem(sample.problemId), 2505)))
  expect(check(widget, sample.answer, toResponse(sample.instance, correctValueFor(sample)))).toEqual(correct)
  expect(check(widget, sample.answer, toResponse(sample.instance, wrongValueFor(sample)))).toEqual(wrong)
  return sample
}

test('the free-form algebra checker proves polynomial equivalence exactly, not at a few sampled points', () => {
  const answer = { grammar: 'polynomial', expression: 'x^2 - 1' }
  expect(check('expression', answer, { text: '(x-1)*(x+1)' })).toEqual(correct)
  expect(check('expression', { grammar: 'polynomial', expression: 'x' }, { text: '1/2*x + 1/2*x' })).toEqual(correct)
  expect(check('expression', { grammar: 'polynomial', expression: '0' }, { text: '(x-1)*(x-2)*(x-3)*(x-4)*(x-5)' })).toEqual(wrong)
  expect(check('expression', answer, { text: 'x^2' })).toEqual(wrong)
  expect(check('expression', answer, { text: 'sqrt(x)' })).toEqual(invalid)
  expect(check('expression', answer, { text: '' })).toEqual(invalid)
  expect(() => check('expression', { grammar: 'sampled', expression: 'x' }, { text: 'x' })).toThrow(TypeError)
})

test('rational answers cross-multiply exactly without permitting a zero denominator', () => {
  const answer = { grammar: 'rational', expression: '(x^2-1)/(x-1)' }
  expect(check('expression', answer, { text: 'x+1' })).toEqual(correct)
  expect(check('expression', answer, { text: '(x+1)/(x-x)' })).toEqual(invalid)
  expect(check('expression', answer, { text: '0/(x-x)' })).toEqual(invalid)
  expect(check('expression', answer, { text: 'x+2' })).toEqual(wrong)
  expect(() => check('expression', { grammar: 'rational', expression: '1/(x-x)' }, { text: 'x+1' })).toThrow()
})

test('a required factored form rejects expanded or cosmetically parenthesized equivalents', () => {
  const answer = { grammar: 'polynomial', expression: 'x^2-1', form: 'factored' }
  expect(check('expression', answer, { text: '(x-1)*(x+1)' })).toEqual(correct)
  expect(check('expression', answer, { text: 'x^2-1' }).correct).toBe(false)
  expect(check('expression', answer, { text: '(x^2-1)' }).correct).toBe(false)
  expect(check('expression', answer, { text: '(x-2)*(x+1)' })).toEqual(wrong)
})

test('ordered steps grade each position instead of accepting a permutation or a shortcut', () => {
  const answer = { steps: [
    { grammar: 'polynomial', expression: '2*(x+1)' },
    { grammar: 'polynomial', expression: '2*x+3' },
  ] }
  expect(check('steps', answer, { steps: ['2*x+2', '3+2*x'] })).toEqual(correct)
  expect(check('steps', answer, { steps: ['2*x+3', '2*x+2'] })).toEqual(wrong)
  expect(check('steps', answer, { steps: ['2*x+2'] })).toEqual(invalid)
  expect(check('steps', answer, { steps: ['2*x+2', ''] })).toEqual(invalid)
  expect(check('steps', answer, { steps: ['2*x+2', '2*x+3', 'extra'] })).toEqual(invalid)
})

test.each(['expression', 'steps'])('%s has a seeded, private, playable curriculum sample and real gallery verdicts', (widget) => {
  const sample = sampleFor(widget)
  const template = getProblem(sample.problemId)
  expect(template).toBeDefined()
  expect(sample.instance.widget).toBe(widget)
  for (let seed = 1; seed <= 500; seed++) {
    const full = renderProblem(template, seed)
    const publicItem = toInstance(full)
    expect(publicItem.widget).toBe(widget)
    expect(publicItem.visual.kind).toBe(widget)
    expect(publicItem.prompt.length).toBeGreaterThan(0)
    expect(JSON.stringify(publicItem)).not.toMatch(/"answer"|"explanation"|"solution"/)
    expect(check(widget, full.answer, toResponse(publicItem, correctValueFor({ ...sample, instance: publicItem, answer: full.answer })))).toEqual(correct)
  }
})

test('a child can type, revise and grade a symbolic expression through the real widget', () => {
  const sample = sampleFor('expression')
  const result = {}
  const view = render(<Harness instance={sample.instance} result={result} />)
  const input = screen.getByRole('textbox', { name: /expression/i })
  expect(view.container.textContent).not.toContain(sample.explanation)
  expect(check('expression', sample.answer, toResponse(sample.instance, result.value))).toEqual(invalid)
  fireEvent.change(input, { target: { value: correctValueFor(sample) } })
  expect(check('expression', sample.answer, toResponse(sample.instance, result.value))).toEqual(correct)
  fireEvent.change(input, { target: { value: wrongValueFor(sample) } })
  expect(check('expression', sample.answer, toResponse(sample.instance, result.value))).toEqual(wrong)
  expect(keysFor('expression')).toContain('^')
  expect(keysFor('expression')).not.toContain('√')
  expect(keysFor('expression')).not.toContain('π')
})

test('a child can fill ordered steps through labelled, independently editable controls', () => {
  const sample = sampleFor('steps')
  const result = {}
  render(<Harness instance={sample.instance} result={result} />)
  const inputs = screen.getAllByRole('textbox', { name: /step/i })
  expect(inputs).toHaveLength(sample.answer.steps.length)
  expect(check('steps', sample.answer, toResponse(sample.instance, result.value))).toEqual(invalid)
  correctValueFor(sample).forEach((text, index) => fireEvent.change(inputs[index], { target: { value: text } }))
  expect(check('steps', sample.answer, toResponse(sample.instance, result.value))).toEqual(correct)
  fireEvent.change(inputs[0], { target: { value: wrongValueFor(sample)[0] } })
  expect(check('steps', sample.answer, toResponse(sample.instance, result.value))).toEqual(wrong)
})

test.each(['expression', 'steps'])('%s disabled answer controls preserve the submitted response', (widget) => {
  const sample = sampleFor(widget)
  const result = {}
  render(<Harness instance={sample.instance} result={result} disabled />)
  const before = toResponse(sample.instance, result.value)
  for (const input of screen.getAllByRole('textbox')) {
    expect(input).toBeDisabled()
    fireEvent.change(input, { target: { value: 'changed' } })
  }
  expect(toResponse(sample.instance, result.value)).toEqual(before)
})
