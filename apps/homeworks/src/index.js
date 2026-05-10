// Homeworks module index
export const createHomeworksState = (initialHomeworks = []) => initialHomeworks

export const addHomework = (state, homework) => [...state, homework]

export const removeHomework = (state, homeworkId) =>
  state.filter((hw) => hw.id !== homeworkId)

export const toggleHomework = (state, homeworkId) =>
  state.map((hw) =>
    hw.id === homeworkId ? { ...hw, completed: !hw.completed } : hw
  )
