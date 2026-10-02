import { describe, expect, it, jest } from '@jest/globals'
import '@testing-library/jest-dom'
import { fireEvent, render, screen } from '@testing-library/react'
import { GardenDecorations } from './GardenDecorations'

const summary = {
  rewards: { sunshine: 6 },
  decorations: {
    catalog: [{ id: 'lantern', name: 'Lantern', price: 3 }, { id: 'bench', name: 'Bench', price: 4 }, { id: 'pond', name: 'Pond', price: 6 }],
    owned: [{ id: 'lantern', name: 'Lantern' }],
  },
}

describe('garden decorations', () => {
  it('renders owned cosmetics and actionable affordable catalog items', () => {
    const onBuy = jest.fn()
    render(<GardenDecorations summary={summary} error="" busy={false} onBuy={onBuy} />)
    expect(screen.getByText('Your Lantern')).toBeInTheDocument()
    const buyButtons = screen.getAllByRole('button', { name: 'Buy decoration' })
    expect(buyButtons).toHaveLength(2)
    fireEvent.click(buyButtons[0])
    expect(onBuy).toHaveBeenCalledWith('bench')
  })

  it('disables unaffordable and already-owned items and retains visible errors', () => {
    render(<GardenDecorations summary={{ ...summary, rewards: { sunshine: 2 } }} error="Purchase failed" busy={false} onBuy={() => {}} />)
    expect(screen.getByRole('alert')).toHaveTextContent('Purchase failed')
    expect(screen.getByRole('button', { name: 'Owned' })).toBeDisabled()
    expect(screen.getAllByRole('button', { name: 'Buy decoration' }).every((button) => button.disabled)).toBe(true)
  })
})
