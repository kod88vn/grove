module.exports = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: [],
  roots: ['<rootDir>'],
  moduleDirectories: ['node_modules', '<rootDir>'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  transform: {
    '^.+\\.(js|jsx)$': ['babel-jest'],
  },
  testMatch: ['<rootDir>/**/*.test.js'],
}
