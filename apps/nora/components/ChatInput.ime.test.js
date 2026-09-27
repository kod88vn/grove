/**
 * Bug: typing with an IME (Vietnamese Telex, Japanese, Chinese, Korean...) sends a
 * half-composed message. Pressing Enter to commit the composition fires keydown with
 * key === 'Enter', and ChatInput's handler treats it as "send" and blocks the keystroke,
 * so the candidate is never committed and the partial text goes to Nora.
 *
 * Browsers mark that keystroke with `isComposing: true`. Safari fires compositionend
 * before keydown, so there `isComposing` is false but `keyCode` is 229. Both must be
 * ignored. A plain Enter must still send, and Shift+Enter must still add a new line.
 */
import { describe, it, expect, jest } from '@jest/globals'
import { render, screen, fireEvent } from '@testing-library/react'
import { ChatInput } from './ChatInput'

function renderInput(value = 'xin chaof') {
  const onSubmit = jest.fn()
  render(<ChatInput value={value} onChange={jest.fn()} onSubmit={onSubmit} isLoading={false} />)
  return { onSubmit, textarea: screen.getByPlaceholderText('Message Nora...') }
}

describe('ChatInput with an input method editor (IME)', () => {
  it('does not send, or swallow the keystroke, when Enter commits an IME composition', () => {
    const { onSubmit, textarea } = renderInput()

    fireEvent.compositionStart(textarea)
    const notPrevented = fireEvent.keyDown(textarea, { key: 'Enter', isComposing: true })

    expect(onSubmit).not.toHaveBeenCalled()
    expect(notPrevented).toBe(true)
  })

  it('does not send on the Safari-style composition Enter (keyCode 229)', () => {
    const { onSubmit, textarea } = renderInput()

    const notPrevented = fireEvent.keyDown(textarea, { key: 'Enter', keyCode: 229, which: 229 })

    expect(onSubmit).not.toHaveBeenCalled()
    expect(notPrevented).toBe(true)
  })

  it('sends once on a plain Enter after the composition has ended', () => {
    const { onSubmit, textarea } = renderInput('xin chào')

    fireEvent.compositionStart(textarea)
    fireEvent.keyDown(textarea, { key: 'Enter', isComposing: true })
    fireEvent.compositionEnd(textarea)
    const notPrevented = fireEvent.keyDown(textarea, { key: 'Enter', keyCode: 13, which: 13 })

    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(notPrevented).toBe(false)
  })

  it('keeps Shift+Enter as a new line, not a send', () => {
    const { onSubmit, textarea } = renderInput('xin chào')

    const notPrevented = fireEvent.keyDown(textarea, { key: 'Enter', keyCode: 13, shiftKey: true })

    expect(onSubmit).not.toHaveBeenCalled()
    expect(notPrevented).toBe(true)
  })
})
