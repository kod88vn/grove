import { describe, expect, it } from '@jest/globals'
import { render, screen } from '@testing-library/react'
import { ModuleGameArcade } from './ModuleGameArcade'

describe('ModuleGameArcade', () => {
  it('renders hangman game view', () => {
    render(
      <ModuleGameArcade
        module={{
          slug: 'hangman',
          title: 'Hangman',
          summary: 'Vocabulary game with themed word packs and hints.',
        }}
      />
    )

    expect(screen.getByText(/Nora Kids Arcade/i)).toBeInTheDocument()
    expect(screen.getByText(/Misses:/i)).toBeInTheDocument()
  })

  it('renders gomoku game view', () => {
    render(
      <ModuleGameArcade
        module={{
          slug: 'gomoku',
          title: 'Gomoku',
          summary: 'Five in a row against AI.',
        }}
      />
    )

    expect(screen.getByText(/Gomoku infinity board/i)).toBeInTheDocument()
    expect(screen.getByText(/AI played the first stone at the center/i)).toBeInTheDocument()
  })
})
