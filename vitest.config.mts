import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import { defineVitestCoverage } from './scripts/test/toolkit/vitestCoverage.mjs';
import { discoverTestProjects, sharedRuntimeFiles, testProjectNames } from './scripts/test/vitest-projects.mts';
import { testRuntimeEnv } from './test/runtime-env.mts';

const projectRoot = fileURLToPath(new URL('.', import.meta.url));
const testFiles = discoverTestProjects(projectRoot);

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(projectRoot, '.'),
      'server-only': resolve(projectRoot, 'vitest.server-only.ts'),
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
    // Each tier runs its isolated files in forks; files that cannot leak state share a thread runtime in a
    // `<tier>-shared` project (see `sharesRuntime`), which skips per-file module and environment setup.
    projects: testProjectNames.flatMap((name) => {
      const { shared, isolated } = sharedRuntimeFiles(projectRoot, testFiles[name]);
      // Source environment directives continue to select jsdom where required.
      // Node logic imports no DOM matchers, polyfills, or Next mock.
      const setupFiles =
        name === 'node-unit'
          ? [resolve(projectRoot, 'test/node.setup.ts')]
          : name === 'server-contract'
            ? [resolve(projectRoot, 'test/next.setup.ts')]
            : [resolve(projectRoot, 'vitest.setup.ts'), resolve(projectRoot, 'test/next.setup.ts')];
      return [
        { extends: true, test: { name, include: isolated, setupFiles } },
        ...(shared.length > 0
          ? [
              {
                extends: true,
                test: {
                  name: `${name}-shared`,
                  include: shared,
                  setupFiles:
                    name === 'component'
                      ? [...setupFiles, resolve(projectRoot, 'test/shared-dom.setup.ts')]
                      : setupFiles,
                  pool: 'threads' as const,
                  isolate: false,
                },
              },
            ]
          : []),
      ];
    }),
    coverage: defineVitestCoverage({
      html: true,
      include: ['components/**/*.ts', 'components/**/*.tsx', 'lib/**/*.ts', 'lib/**/*.tsx'],
      exclude: ['components/**/*.test.ts', 'components/**/*.test.tsx', 'lib/**/*.test.ts', 'lib/**/*.test.tsx'],
    }),
  },
});
