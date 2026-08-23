import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.test.ts'],
    setupFiles: ['src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      // index.ts is pure wiring with top-level side effects; logger.ts is
      // configuration that every test mocks; dto/** are type-only declarations.
      exclude: ['src/index.ts', 'src/logger.ts', 'src/dto/**', 'src/test/**', 'src/**/*.test.ts'],
    },
  },
});
