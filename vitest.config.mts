import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import { defineVitestCoverage } from './scripts/test/toolkit/vitestCoverage.mjs';
import {
  discoverTestProjects,
  sharedRuntimeFiles,
  testProjectNames,
  vmRuntimeFiles,
} from './scripts/test/vitest-projects.mts';
import { testRuntimeEnv } from './test/runtime-env.mts';

const projectRoot = fileURLToPath(new URL('.', import.meta.url));
// V8 bytecode of Vitest and externalized dependencies, reused across runs; Vitest passes it to its workers.
// CI restores the same directory. `NODE_DISABLE_COMPILE_CACHE=1` turns it off.
process.env.NODE_COMPILE_CACHE ??= resolve(projectRoot, 'node_modules/.cache/node-compile-cache');
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
    // A VM-context worker is recycled once its heap passes this. Vitest's default (1/maxWorkers of system
    // memory) would let the CI workers claim the whole runner.
    vmMemoryLimit: '1GiB',
    // Each tier runs its isolated files in forks; files that cannot leak state share a thread runtime in a
    // `<tier>-shared` project (see `sharesRuntime`), which skips per-file module and environment setup.
    // Isolated jsdom component files run in VM contexts in `component-vm` (see `runsInVmContext`): each file
    // keeps its own jsdom and modules, without a process per file.
    projects: testProjectNames.flatMap((name) => {
      const { shared, isolated } = sharedRuntimeFiles(projectRoot, testFiles[name]);
      const { vm, forks } = vmRuntimeFiles(projectRoot, isolated);
      // Source environment directives continue to select jsdom where required.
      // Node logic imports no DOM matchers, polyfills, or Next mock.
      const setupFiles =
        name === 'node-unit'
          ? [resolve(projectRoot, 'test/node.setup.ts')]
          : name === 'server-contract'
            ? [resolve(projectRoot, 'test/next.setup.ts')]
            : [resolve(projectRoot, 'vitest.setup.ts'), resolve(projectRoot, 'test/next.setup.ts')];
      return [
        { extends: true, test: { name, include: forks, setupFiles } },
        ...(vm.length > 0
          ? [
              {
                extends: true,
                test: {
                  name: `${name}-vm`,
                  include: vm,
                  setupFiles: [resolve(projectRoot, 'test/vm-context.setup.ts'), ...setupFiles],
                  pool: 'vmThreads' as const,
                },
              },
            ]
          : []),
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
