import { render, screen, fireEvent } from '@testing-library/react'
import MemoryGame from '@/components/games/MemoryGame'

describe('MemoryGame', () => {
  test('renders menu and starts game', () => {
    render(<MemoryGame />)
    expect(screen.getByText(/Memory Match/i)).toBeInTheDocument()
    
    // Start game
    fireEvent.click(screen.getByText(/Start Match/i))
    
    expect(screen.getByText(/Matches: 0 /i)).toBeInTheDocument()
  })

  test('renders a grid of cards after starting', () => {
    render(<MemoryGame />)
    fireEvent.click(screen.getByText(/Start Match/i))
    
    // Check for flip-card class or multiple cards
    const cards = screen.getAllByRole('button') 
    expect(cards.length).toBeGreaterThan(0)
  })
})
