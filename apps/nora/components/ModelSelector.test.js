import { render, screen, fireEvent } from '@testing-library/react'
import { ModelSelector } from '../components/ModelSelector.js'

describe('ModelSelector', () => {
  const modelList = ['model1', 'model2', 'model3']
  const selectedModel = 'model2'
  const onChange = jest.fn()

  it('renders select with options', () => {
    render(<ModelSelector modelList={modelList} selectedModel={selectedModel} onChange={onChange} />)
    const select = screen.getByRole('combobox')
    expect(select).toHaveValue('model2')
    expect(screen.getByText('model1')).toBeInTheDocument()
    expect(screen.getByText('model2')).toBeInTheDocument()
    expect(screen.getByText('model3')).toBeInTheDocument()
  })

  it('calls onChange when selection changes', () => {
    render(<ModelSelector modelList={modelList} selectedModel={selectedModel} onChange={onChange} />)
    const select = screen.getByRole('combobox')
    fireEvent.change(select, { target: { value: 'model1' } })
    expect(onChange).toHaveBeenCalledWith('model1')
  })

  it('is disabled when disabled prop is true', () => {
    render(<ModelSelector modelList={modelList} selectedModel={selectedModel} onChange={onChange} disabled={true} />)
    const select = screen.getByRole('combobox')
    expect(select).toBeDisabled()
  })
})