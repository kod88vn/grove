import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'
import '@testing-library/jest-dom'
import { render, screen, waitFor } from '@testing-library/react'

import { SkillsLibrary } from '../components/SkillsLibrary'

describe('SkillsLibrary catalog view', () => {
  beforeEach(() => {
    global.fetch = jest.fn()
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  it('renders full catalog skills even when there is no progress yet', async () => {
    global.fetch.mockImplementation(async (url) => {
      const requestUrl = String(url)

      if (requestUrl.includes('view=catalog')) {
        return {
          ok: true,
          json: async () => ({
            categories: [
              {
                key: 'multiplication',
                category: 'Multiplication',
                categoryId: 'multiply',
                skills: [
                  {
                    id: 'long-multiplication',
                    name: 'Long Multiplication',
                    label: '✖️ Long Multiplication',
                    description: 'Multiply 2-digit by 2-digit numbers',
                  },
                ],
              },
            ],
          }),
        }
      }

      if (requestUrl.includes('view=summary')) {
        return {
          ok: true,
          json: async () => ({ summary: [] }),
        }
      }

      if (requestUrl.includes('view=stats')) {
        return {
          ok: true,
          json: async () => ({
            stats: {
              totalProblems: 0,
              skillsAttempted: 0,
              averageScore: 0,
            },
          }),
        }
      }

      return {
        ok: true,
        json: async () => ({ items: [] }),
      }
    })

    render(<SkillsLibrary studentId="default" />)

    expect(await screen.findByText('Grade 5 Categories')).toBeInTheDocument()
    expect(await screen.findByText(/Long Multiplication/)).toBeInTheDocument()
    expect(await screen.findByText('Not started')).toBeInTheDocument()
    expect(await screen.findByRole('link', { name: 'Practice This Section' })).toHaveAttribute(
      'href',
      '/?section=math&practice=1&skillCategory=multiplication'
    )

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled()
    })
  })
})
