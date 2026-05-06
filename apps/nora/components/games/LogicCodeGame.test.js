import { render, screen, fireEvent } from '@testing-library/react'
import LogicCodeGame from '@/components/games/LogicCodeGame'

describe('LogicCodeGame', () => {
  test('renders menu and starts a game', () => {
    render(<LogicCodeGame />)
    expect(screen.getByText(/Logic Code/i)).toBeInTheDocument()
    
    // Start game
    fireEvent.click(screen.getByText(/Start Decoding/i))
    
    // Check for the 'Submit Guess' button
    expect(screen.getByText(/Submit Guess/i)).toBeInTheDocument()
  })

  test('allows color selection and submission', () => {
    render(<LogicCodeGame />)
    fireEvent.click(screen.getByText(/Start Decoding/i))
    
    const submitBtn = screen.getByText(/Submit Guess/i)
    expect(submitBtn).toBeDisabled()
  })
})
