import { render, screen, fireEvent } from '@testing-library/react'
import HangmanGame from './HangmanGame'
import { pickHangmanRound } from '@/lib/modules/games'

// Mock the round picker to get a predictable word
jest.mock('@/lib/modules/games', () => ({
  ...jest.requireActual('@/lib/modules/games'),
  pickHangmanRound: jest.fn(() => ({
    word: 'TEST',
    hint: 'A simple trial',
    mascot: '🧪'
  }))
}))

describe('HangmanGame', () => {
  it('renders correctly and reveals letters on guess', () => {
    render(<HangmanGame />)
    
    // Check for hint
    expect(screen.getByText(/A simple trial/)).toBeInTheDocument()
    
    // Check initial masked word (T E S T -> _ _ _ _)
    expect(screen.getByText(/_ _ _ _/)).toBeInTheDocument()
    
    // Guess 'T'
    const tButton = screen.getByText('T')
    fireEvent.click(tButton)
    
    // Word should now be T _ _ T
    expect(screen.getByText(/T _ _ T/)).toBeInTheDocument()
  })

  it('increments wrong count on incorrect guess', () => {
    render(<HangmanGame />)
    
    // Chances left should be 7
    expect(screen.getByText(/Chances Left:/)).toHaveTextContent('7')
    
    // Guess 'X' (not in TEST)
    const xButton = screen.getByText('X')
    fireEvent.click(xButton)
    
    // Chances left should be 6
    expect(screen.getByText(/Chances Left:/)).toHaveTextContent('6')
  })
})
