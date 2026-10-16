import { resolve } from 'path';
import { defineConfig } from 'vitest/config';
import { defineVitestCoverage } from './scripts/test/toolkit/vitestCoverage.mjs';
import { discoverTestProjects, testProjectNames } from './scripts/test/vitest-projects';
import { testRuntimeEnv } from './test/runtime-env';

const testFiles = discoverTestProjects(__dirname);

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
    env: testRuntimeEnv,
    unstubEnvs: true,
    projects: testProjectNames.map((name) => ({
      extends: true,
      test: {
        name,
        include: testFiles[name],
        // Source environment directives continue to select jsdom where required.
        // Node logic imports no DOM matchers, polyfills, or Next mock.
        setupFiles:
          name === 'node-unit'
            ? [resolve(__dirname, 'test/node.setup.ts')]
            : name === 'server-contract'
              ? [resolve(__dirname, 'test/next.setup.ts')]
              : [resolve(__dirname, 'vitest.setup.ts'), resolve(__dirname, 'test/next.setup.ts')],
      },
    })),
    coverage: defineVitestCoverage({
      html: true,
      include: ['components/**/*.ts', 'components/**/*.tsx', 'lib/**/*.ts', 'lib/**/*.tsx'],
      exclude: ['components/**/*.test.ts', 'components/**/*.test.tsx', 'lib/**/*.test.ts', 'lib/**/*.test.tsx'],
    }),
  },
});
