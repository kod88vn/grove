import { render, screen, fireEvent, act } from '@testing-library/react'
import MathQuizGame from '@/components/games/MathQuizGame'

// Mock timer to avoid waiting
jest.useFakeTimers()

describe('MathQuizGame', () => {
  test('renders menu and starts a game level', () => {
    render(<MathQuizGame />)
    expect(screen.getByText(/Math Lightning/i)).toBeInTheDocument()
    
    const rookieBtn = screen.getByText(/Rookie/i)
    fireEvent.click(rookieBtn)
    
    // Should show the round and timer
    expect(screen.getByText(/Round/i)).toBeInTheDocument()
    expect(screen.getByText(/Time Left/i)).toBeInTheDocument()
  })

  test('increments round on answer submission', () => {
    render(<MathQuizGame />)
    fireEvent.click(screen.getByText(/Rookie/i))
    
    const input = screen.getByPlaceholderText('?')
    fireEvent.change(input, { target: { value: '999' } }) // Wrong answer but it advances round
    fireEvent.submit(input.closest('form'))
    
    expect(screen.getByText(/2 \/ 10/i)).toBeInTheDocument()
  })
})
