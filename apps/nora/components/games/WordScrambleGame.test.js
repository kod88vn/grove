import { render, screen, fireEvent, act } from '@testing-library/react'
import WordScrambleGame from '@/components/games/WordScrambleGame'

describe('WordScrambleGame', () => {
  test('renders game and handles input', () => {
    render(<WordScrambleGame />)
    expect(screen.getByText(/Word Scramble/i)).toBeInTheDocument()
    
    // Start game
    fireEvent.click(screen.getByText(/Start Playing/i))

    expect(screen.getByText(/Score: 0/i)).toBeInTheDocument()
    
    // Check if input exists
    const input = screen.getByPlaceholderText(/\?\?\?/i)
    expect(input).toBeInTheDocument()
  })

  test('shows hint automatically', () => {
    render(<WordScrambleGame />)
    fireEvent.click(screen.getByText(/Start Playing/i))
    
    // Hint icon or lightbulb emoji usually appears
    expect(screen.getByText(/💡/)).toBeInTheDocument()
  })
})
