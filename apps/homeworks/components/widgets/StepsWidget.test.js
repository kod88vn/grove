import { fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { StepsWidget } from './StepsWidget'

test('ordered step controls keep separate labels and revise only the selected position', () => {
  const onChange = jest.fn()
  const instance = {
    prompt: 'Simplify in order.',
    visual: { items: [{ id: 'step-1', label: 'Step 1' }, { id: 'step-2', label: 'Step 2' }] },
  }
  render(<StepsWidget instance={instance} value={['', '']} onChange={onChange} />)
  const [first, second] = screen.getAllByRole('textbox', { name: /step/i })
  fireEvent.change(second, { target: { value: '12*3' } })
  expect(onChange).toHaveBeenCalledWith(['', '12*3'])
  fireEvent.change(first, { target: { value: '12' } })
  expect(onChange).toHaveBeenLastCalledWith(['12', ''])
})
