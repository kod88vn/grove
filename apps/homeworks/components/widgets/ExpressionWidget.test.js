import { fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { ExpressionWidget } from './ExpressionWidget'

test('the expression control is labelled, controlled, and disabled without emitting edits', () => {
  const onChange = jest.fn()
  const instance = { prompt: 'Factor the expression.', visual: { expression: 'x^2 - 9' } }
  const { rerender } = render(<ExpressionWidget instance={instance} value="(x-3)*(x+3)" onChange={onChange} />)
  const input = screen.getByRole('textbox', { name: /expression/i })
  expect(input).toHaveValue('(x-3)*(x+3)')
  fireEvent.change(input, { target: { value: 'x^2-9' } })
  expect(onChange).toHaveBeenCalledWith('x^2-9')

  onChange.mockClear()
  rerender(<ExpressionWidget instance={instance} value="x^2-9" onChange={onChange} disabled />)
  expect(screen.getByRole('textbox', { name: /expression/i })).toBeDisabled()
  fireEvent.change(screen.getByRole('textbox', { name: /expression/i }), { target: { value: 'changed' } })
  expect(onChange).not.toHaveBeenCalled()
})
