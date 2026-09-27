import '@testing-library/jest-dom'

// The page persists to localStorage; jsdom keeps it for the whole test file.
afterEach(() => window.localStorage.clear())
