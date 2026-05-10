module.exports = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: [],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  transform: {
    '^.+\\.(js|jsx)$': ['babel-jest'],
  },
  testMatch: ['<rootDir>/test/**/*.test.js'],
}
