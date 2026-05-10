import {
  createHomeworksState,
  addHomework,
  removeHomework,
  toggleHomework,
} from '../src/index'

describe('Homeworks module', () => {
  it('creates initial state', () => {
    const state = createHomeworksState()
    expect(state).toEqual([])
  })

  it('adds a homework', () => {
    const state = createHomeworksState([])
    const homework = { id: 'hw-1', title: 'Math assignment', completed: false }
    const newState = addHomework(state, homework)
    expect(newState).toHaveLength(1)
    expect(newState[0]).toEqual(homework)
  })

  it('removes a homework', () => {
    const state = createHomeworksState([
      { id: 'hw-1', title: 'Math', completed: false },
      { id: 'hw-2', title: 'Science', completed: false },
    ])
    const newState = removeHomework(state, 'hw-1')
    expect(newState).toHaveLength(1)
    expect(newState[0].id).toBe('hw-2')
  })

  it('toggles homework completion', () => {
    const state = createHomeworksState([
      { id: 'hw-1', title: 'Math', completed: false },
    ])
    const newState = toggleHomework(state, 'hw-1')
    expect(newState[0].completed).toBe(true)
  })
})
