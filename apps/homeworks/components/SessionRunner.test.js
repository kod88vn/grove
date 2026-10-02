import { afterEach, describe, expect, it } from '@jest/globals'
import '@testing-library/jest-dom'
import { fireEvent, render, screen } from '@testing-library/react'
import { getProblem, listProblems, render as renderProblem, toInstance } from '@grove/curriculum'

import { KidSettingsProvider } from './KidSettingsProvider'
import { SessionRunner } from './SessionRunner'

const sessionId = 'issued-session'
const studentId = 'selected-child'
const skill = 'm5.oa.order-of-operations'
const problems = listProblems({ skill })
const problem = problems[0]
const rendered = renderProblem(getProblem(problem.id), 153)
const instance = toInstance(rendered)

function installApi({ finishFailsOnce = false, experienceFails = false } = {}) {
  let finishCalls = 0
  global.fetch = async (url) => {
    if (url === `/homeworks/api/problems?skill=${skill}`) return { ok: true, json: async () => ({ problems }) }
    if (url === `/homeworks/api/sessions/${sessionId}/items`) return { ok: true, json: async () => ({ seed: instance.seed, instance }) }
    if (url === '/homeworks/api/attempts') return { ok: true, json: async () => ({ correct: true, stars: 3, feedback: 'Great work!', explanation: rendered.explanation }) }
    if (url === `/homeworks/api/sessions/${sessionId}/finish`) {
      finishCalls += 1
      if (finishFailsOnce && finishCalls === 1) return { ok: false, status: 503, json: async () => ({ error: 'Storage unavailable' }) }
      return { ok: true, json: async () => ({
        finished: true, stars: 1, grew: [{ skillId: skill, name: 'Order of Operations', from: 'seed', to: 'sprout' }],
        next: { id: 'm5.nf.add-fractions-unlike', problemId: 'm5.nf.add-fractions-unlike/add-fractions', label: 'Add Fractions' },
      }) }
    }
    if (url.startsWith(`/homeworks/api/kid-experience?studentId=${studentId}&date=`)) return experienceFails
      ? { ok: false, status: 503, json: async () => ({ error: 'Grove details unavailable' }) }
      : {
        ok: true,
        json: async () => ({
        rewards: { stars: 3, sunshine: 3 },
        garden: [{ skillId: skill, name: 'Order of Operations', stage: 'sprout' }],
        suggestions: [{ id: 'm5.nf.add-fractions-unlike', label: 'Add Fractions', name: 'Add Fractions' }],
      }),
      }
    throw new Error(`Unexpected request: ${url}`)
  }
}

async function answerCurrentProblem() {
  if (rendered.widget === 'steps') {
    const fields = await screen.findAllByRole('textbox', { name: /step/i })
    fields.forEach((field, index) => fireEvent.change(field, { target: { value: rendered.answer.steps[index].expression } }))
  } else {
    fireEvent.change(await screen.findByLabelText('Your answer'), { target: { value: String(rendered.answer.value) } })
  }
  fireEvent.click(screen.getByRole('button', { name: /Check/ }))
  await screen.findByText('How Nora solved it')
}

afterEach(() => { delete global.fetch })

describe('session-end card', () => {
  it('shows session stars, persisted grove sprouts, and the next suggestion after finishing', async () => {
    installApi()
    render(<SessionRunner sessionId={sessionId} studentId={studentId} skill={skill} count={1} />)
    await screen.findByText(instance.prompt)
    await answerCurrentProblem()
    fireEvent.click(screen.getByRole('button', { name: /Finish/ }))
    expect(await screen.findByLabelText('1 stars earned')).toBeInTheDocument()
    expect(screen.getByText('☀️ 3 Sunshine in your grove.')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Skills you grew' })).toBeInTheDocument()
    expect(screen.getByText('🌱 Order of Operations')).toBeInTheDocument()
    expect(screen.getByText('🌱 Order of Operations').closest('li')).toHaveClass('motion-safe:animate-pulse')
    expect(screen.getByRole('link', { name: 'Next suggestion: Add Fractions' })).toHaveAttribute('href', expect.stringContaining('/q/'))
  })

  it('does not animate session growth when the device requests reduced motion', async () => {
    installApi()
    const originalMatchMedia = window.matchMedia
    window.matchMedia = () => ({ matches: true, addEventListener: () => {}, removeEventListener: () => {} })
    try {
      render(<KidSettingsProvider><SessionRunner sessionId={sessionId} studentId={studentId} skill={skill} count={1} /></KidSettingsProvider>)
      await screen.findByText(instance.prompt)
      await answerCurrentProblem()
      fireEvent.click(screen.getByRole('button', { name: /Finish/ }))
      const grew = await screen.findByText('🌱 Order of Operations')
      expect(grew.closest('li')).not.toHaveClass('motion-safe:animate-pulse')
    } finally {
      window.matchMedia = originalMatchMedia
    }
  })

  it('keeps the solved problem and offers a retry when saving the finish fails', async () => {
    installApi({ finishFailsOnce: true })
    render(<SessionRunner sessionId={sessionId} studentId={studentId} skill={skill} count={1} />)
    await screen.findByText(instance.prompt)
    await answerCurrentProblem()

    fireEvent.click(screen.getByRole('button', { name: /Finish/ }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Storage unavailable')
    expect(screen.getByText('How Nora solved it')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Great work!' })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('0 stars earned')).not.toBeInTheDocument()

    const retry = screen.getByRole('button', { name: /Finish|Retry/i })
    expect(retry).toBeEnabled()
    fireEvent.click(retry)
    expect(await screen.findByLabelText('1 stars earned')).toBeInTheDocument()
  })

  it('keeps the earned finish card when only grove details fail to load', async () => {
    installApi({ experienceFails: true })
    render(<SessionRunner sessionId={sessionId} studentId={studentId} skill={skill} count={1} />)
    await screen.findByText(instance.prompt)
    await answerCurrentProblem()
    fireEvent.click(screen.getByRole('button', { name: /Finish/ }))

    expect(await screen.findByLabelText('1 stars earned')).toBeInTheDocument()
    expect(screen.getByText('Great work!')).toBeInTheDocument()
    expect(await screen.findByRole('alert')).toHaveTextContent('Your session is saved, but grove details couldn\'t load: Grove details unavailable')
  })
})