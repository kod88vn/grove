import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    environment: 'node',
    // Deterministic by policy: no test may depend on wall-clock time or ordering.
    sequence: { shuffle: false },
    restoreMocks: true,
  },
});
