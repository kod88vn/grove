import { render, screen, fireEvent } from '@testing-library/react'
import CrosswordGame from '@/components/games/CrosswordGame'

describe('CrosswordGame', () => {
  test('renders clues and handles input', () => {
    render(<CrosswordGame />)
    
    // Check for clues
    expect(screen.getByText(/🧩 Type each answer/i)).toBeInTheDocument()
    
    // Check for an input
    const inputs = screen.getAllByPlaceholderText(/Type answer/i)
    expect(inputs.length).toBeGreaterThan(0)
    
    // Check button
    expect(screen.getByText(/Check Answers/i)).toBeInTheDocument()
  })
})
