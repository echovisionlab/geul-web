import { resolve } from 'path';
import { defineConfig } from 'vitest/config';
import { defineVitestCoverage } from './scripts/test/toolkit/vitestCoverage.mjs';

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, '.'),
      'server-only': resolve(__dirname, 'vitest.server-only.ts'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    pool: 'forks',
    fileParallelism: true,
    isolate: true,
    setupFiles: [resolve(__dirname, 'vitest.setup.ts')],
    include: ['**/*.test.ts', '**/*.test.tsx'],
    exclude: ['node_modules', '.next', '.next-integration-*', 'storybook-static'],
    coverage: defineVitestCoverage({
      html: true,
      include: ['components/**/*.ts', 'components/**/*.tsx', 'lib/**/*.ts', 'lib/**/*.tsx'],
      exclude: ['components/**/*.test.ts', 'components/**/*.test.tsx', 'lib/**/*.test.ts', 'lib/**/*.test.tsx'],
    }),
  },
});
