import { describe, expect, it, jest } from '@jest/globals'
import '@testing-library/jest-dom'
import { fireEvent, render, screen } from '@testing-library/react'
import { KidProfilePicker } from './KidProfilePicker'

function renderPicker(overrides = {}) {
  const props = {
    students: [{ id: 'kid-a', display_name: 'Mina', avatar: '🦊', grade: 5 }],
    studentId: 'kid-a', onStudentChange: jest.fn(), name: '', onNameChange: jest.fn(),
    grade: '5', onGradeChange: jest.fn(), avatar: '🦊', onAvatarChange: jest.fn(),
    busy: false, onCreateStudent: jest.fn((event) => event.preventDefault()),
    ...overrides,
  }
  return { props, ...render(<KidProfilePicker {...props} />) }
}

describe('kid profile picker', () => {
  it('labels the selected child, profile fields, and creation action accessibly', () => {
    renderPicker()
    expect(screen.getByLabelText("Who's practicing?")).toHaveValue('kid-a')
    expect(screen.getByLabelText('Name')).toHaveAttribute('placeholder', 'Add a kid profile')
    expect(screen.getByLabelText('Choose an avatar')).toHaveValue('🦊')
    expect(screen.getByLabelText('Grade')).toHaveValue('5')
    expect(screen.getByRole('button', { name: 'Add profile' })).toBeEnabled()
  })

  it('forwards profile changes and disables creation while a request is active', () => {
    const { props } = renderPicker({ busy: true })
    fireEvent.change(screen.getByLabelText("Who's practicing?"), { target: { value: 'kid-b' } })
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Theo' } })
    fireEvent.change(screen.getByLabelText('Choose an avatar'), { target: { value: '🐻' } })
    fireEvent.change(screen.getByLabelText('Grade'), { target: { value: '4' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add profile' }))

    expect(props.onStudentChange).toHaveBeenCalled()
    expect(props.onNameChange).toHaveBeenCalledWith('Theo')
    expect(props.onAvatarChange).toHaveBeenCalledWith('🐻')
    expect(props.onGradeChange).toHaveBeenCalledWith('4')
    expect(props.onCreateStudent).not.toHaveBeenCalled()
  })
})
