import { describe, expect, it } from '@jest/globals'
import { render, screen } from '@testing-library/react'
import HomePage from './page'

jest.mock('@/lib/home/dashboard', () => ({
  getHomeDashboardData: jest.fn(async () => ({
    user: {
      login: 'parent@example.com',
      name: 'Alex',
      initials: 'A',
    },
    greeting: 'Good morning',
    headline: 'Keep tonight light: one pickup run, two reminders, and rain after school.',
    weather: {
      summary: 'Light rain after 3 PM',
      temperature: '68F',
      locationLabel: 'Home base',
    },
    profile: {
      summary: 'Nora is leaning into school logistics, meal planning, and family admin.',
      interests: ['school logistics', 'meal planning', 'family admin'],
    },
    brief: [
      {
        id: 'school',
        title: 'School traffic alert',
        summary: 'Leave 10 minutes early for pickup because of a parade detour.',
        tag: 'Family logistics',
      },
    ],
    shoppingList: [
      { id: 'milk', label: 'Milk', detail: '2 cartons' },
      { id: 'fruit', label: 'Fruit', detail: 'Lunchbox refill' },
    ],
    reminders: [
      { id: 'library', title: 'Return library books', dueLabel: 'Today · 4:30 PM' },
      { id: 'forms', title: 'Sign camp forms', dueLabel: 'Tomorrow · Morning' },
    ],
    quickActions: [
      { id: 'chat', label: 'Ask Nora', href: '/chat' },
      { id: 'shopping', label: 'Open shopping list', href: '/modules/shopping-list' },
    ],
  })),
}))

describe('HomePage', () => {
  it('renders the family dashboard with weather, brief, shopping list, and reminders', async () => {
    render(await HomePage())

    expect(screen.getByRole('heading', { name: /good .* alex/i })).toBeInTheDocument()
    expect(screen.getByText(/light rain after 3 pm/i)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /personal brief/i })).toBeInTheDocument()
    expect(screen.getByText(/school traffic alert/i)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /shopping list/i })).toBeInTheDocument()
    expect(screen.getByText(/milk/i)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /reminders/i })).toBeInTheDocument()
    expect(screen.getByText(/return library books/i)).toBeInTheDocument()
  })
})
