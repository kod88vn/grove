const nextJest = require('next/jest')

const createJestConfig = nextJest({
  dir: './',
})

const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'jest-environment-jsdom',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  testMatch: ['**/*.test.js'],
  testPathIgnorePatterns: ['<rootDir>/.next/', '<rootDir>/node_modules/'],
  // Coverage gate: measure the chat routing library as a unit rather than a
  // hand-picked list of files. The threshold is intentionally lower than the
  // old vanity metric so it reflects the actual production surface.
  collectCoverageFrom: [
    'app/api/chat/lib/**/*.js',
  ],
  coverageThreshold: {
    global: {
      statements: 65,
      branches: 50,
      functions: 80,
      lines: 70,
    },
  },
}

module.exports = createJestConfig(customJestConfig)
