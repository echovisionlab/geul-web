// @geul-test-tier node-unit

import { execFileSync, spawnSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from '@typescript/tooling';
import { afterEach, describe, expect, it } from 'vitest';
import { nextTypeScriptConfig } from '../next-typescript-config.mjs';

const root = fileURLToPath(new URL('../..', import.meta.url));
const require = createRequire(import.meta.url);
const fixtures: string[] = [];
const portable = (path: string) => path.split(sep).join('/');
const owners = new Set(['app', 'components', 'features', 'hooks', 'i18n', 'lib', 'types']);
const rootSources = [
  'theme.ts',
  'proxy.ts',
  'instrumentation.ts',
  'instrumentation-client.ts',
  'global.d.ts',
  'next-env.d.ts',
];
const storyOnlyTests = [
  'features/auth/ui/auth-accessibility.test.tsx',
  'features/my/account-controls-accessibility.test.tsx',
  'features/share/ui/ShareLinkSectionView.test.tsx',
];
const inventory = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], {
  cwd: root,
  encoding: 'utf8',
})
  .split('\0')
  .filter((file) => file && existsSync(join(root, file)));

function isTestOrFixture(file: string) {
  return (
    file.split('/').some((part) => ['fixtures', '__fixtures__', '__tests__'].includes(part)) ||
    /\.(?:test|spec|type-test|story|stories|test-fixture|fixtures)\.|-fixtures\./.test(file) ||
    file.endsWith('/type-test-env.d.ts')
  );
}

const productionSources = inventory
  .filter(
    (file) =>
      /\.(?:[cm]?[jt]s|[jt]sx)$/.test(file) &&
      (owners.has(file.split('/')[0]) || rootSources.includes(file)) &&
      !isTestOrFixture(file),
  )
  .sort();

function parseConfig(config: string, projectRoot = root) {
  const parsed = ts.getParsedCommandLineOfConfigFile(
    resolve(projectRoot, config),
    {},
    {
      ...ts.sys,
      onUnRecoverableConfigFileDiagnostic: (diagnostic) => {
        throw new Error(ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'));
      },
    },
  );
  if (!parsed) {
    throw new Error(`Cannot parse ${config}`);
  }
  expect(parsed.errors).toEqual([]);
  return parsed;
}

function roots(config: ts.ParsedCommandLine, projectRoot = root) {
  return new Set(config.fileNames.map((file) => portable(relative(projectRoot, file))));
}

function write(target: string, contents: string) {
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, contents);
}

function fixtureProject() {
  const workspace = mkdtempSync(join(tmpdir(), 'geul-typecheck-configs-'));
  fixtures.push(workspace);
  const project = join(workspace, 'geul-web');
  mkdirSync(project);
  for (const config of [
    'tsconfig.json',
    'tsconfig.app.json',
    'tsconfig.app.local-contracts.json',
    'tsconfig.local-contracts.json',
    'tsconfig.local-contracts-paths.json',
  ]) {
    copyFileSync(join(root, config), join(project, config));
  }
  return project;
}

afterEach(() => {
  for (const fixture of fixtures.splice(0)) {
    rmSync(fixture, { recursive: true, force: true });
  }
});

describe('production and full typecheck boundaries', () => {
  it.each(['tsconfig.app.json', 'tsconfig.app.local-contracts.json'])(
    '%s includes every Git production source without test, story or fixture roots',
    (config) => {
      const selected = [...roots(parseConfig(config))];
      expect(productionSources.length).toBeGreaterThan(0);
      expect(selected.filter((file) => inventory.includes(file)).sort()).toEqual(productionSources);
      expect(selected.filter(isTestOrFixture)).toEqual([]);
    },
  );

  it('keeps every Git TypeScript test in each full checker or the dedicated Storybook checker', () => {
    const story = roots(parseConfig('.storybook/tsconfig.json'));
    const tests = inventory.filter((file) => /\.(?:test|spec|type-test)\.(?:[cm]?ts|tsx)$/.test(file));
    expect(tests.length).toBeGreaterThan(0);
    for (const config of ['tsconfig.json', 'tsconfig.local-contracts.json']) {
      const full = roots(parseConfig(config));
      expect(
        tests.filter((file) => !full.has(file) && !story.has(file)),
        config,
      ).toEqual([]);
      for (const file of storyOnlyTests) {
        expect(full.has(file), `${config}: ${file}`).toBe(false);
        expect(story.has(file), file).toBe(true);
      }
    }
  });

  it('isolates standalone incremental caches while retaining strict library checks', () => {
    const configs = [
      ['tsconfig.json', undefined],
      ['tsconfig.local-contracts.json', '.cache/typescript/full-local-contracts.tsbuildinfo'],
      ['tsconfig.app.json', '.cache/typescript/app.tsbuildinfo'],
      ['tsconfig.app.local-contracts.json', '.cache/typescript/app-local-contracts.tsbuildinfo'],
    ] as const;
    for (const [config, cache] of configs) {
      const { options } = parseConfig(config);
      expect(options.strict, config).toBe(true);
      expect(options.skipLibCheck, config).toBe(false);
      expect(options.incremental, config).toBe(true);
      expect(options.tsBuildInfoFile, config).toBe(cache && resolve(root, cache));
    }
  });

  it('keeps Next config inheritance compatible with Turbopack single-string extends', () => {
    const project = fixtureProject();
    const entries = new Set(['tsconfig.local-contracts.json']);
    for (const useLocalContracts of [false, true]) {
      for (const distDir of [undefined, '.artifacts/next custom']) {
        entries.add(nextTypeScriptConfig({ rootDir: project, useLocalContracts, distDir }).tsconfigPath);
      }
    }

    // Next 16.3.8 reads extends only through json["extends"].as_str():
    // https://github.com/vercel/next.js/blob/v16.3.8/turbopack/crates/turbopack-resolve/src/typescript.rs#L81-L100
    // Assert that external capability precondition; TS accepts arrays that Turbopack ignores.
    for (const entry of entries) {
      const chain = new Set<string>();
      let configPath = resolve(project, entry);
      for (;;) {
        expect(chain.has(configPath), `${entry}: inheritance cycle at ${configPath}`).toBe(false);
        chain.add(configPath);
        const config = JSON.parse(readFileSync(configPath, 'utf8'));
        if (config.extends === undefined) {
          break;
        }
        expect(typeof config.extends, `${configPath}: Turbopack requires a single string extends`).toBe('string');
        configPath = resolve(dirname(configPath), config.extends);
      }
    }
  });

  it.each([
    [false, '.next', 'tsconfig.app.json'],
    [true, '.next-local-contracts', 'tsconfig.app.local-contracts.json'],
  ] as const)(
    'reuses the default config for Next-equivalent DIST_DIR values, local=%s',
    (useLocalContracts, output, config) => {
      const project = fixtureProject();
      for (const distDir of [`./${output}/`, `/${output}`]) {
        expect(nextTypeScriptConfig({ rootDir: project, useLocalContracts, distDir })).toEqual({
          distDir,
          tsconfigPath: config,
        });
      }
    },
  );

  it.each([
    [false, undefined, '.next', 'tsconfig.app.json'],
    [true, undefined, '.next-local-contracts', 'tsconfig.app.local-contracts.json'],
    [false, '.artifacts/next custom', '.artifacts/next custom', undefined],
    [true, 'build-output/local', 'build-output/local', undefined],
  ] as const)(
    'selects only the production route validators for local=%s, DIST_DIR=%s',
    (useLocalContracts, distDir, expectedOutput, expectedConfig) => {
      const project = fixtureProject();
      for (const owner of owners) {
        symlinkSync(join(root, owner), join(project, owner), 'dir');
      }
      for (const file of rootSources) {
        write(join(project, file), 'export {};\n');
      }
      const outputs = new Set([
        '.next',
        '.next-local-contracts',
        '.next/dev',
        '.next-local-contracts/dev',
        '.next-integration',
        '.next-integration/dev',
        '.next-integration-fixture',
        '.artifacts/next custom',
        'build-output/local',
        `${expectedOutput}/dev`,
      ]);
      for (const output of outputs) {
        write(join(project, output, 'types/validator.ts'), 'export {};\n');
      }
      const selected = nextTypeScriptConfig({ rootDir: project, useLocalContracts, distDir });
      expect(selected.distDir).toBe(expectedOutput);
      if (expectedConfig) {
        expect(selected.tsconfigPath).toBe(expectedConfig);
      }
      const files = roots(parseConfig(selected.tsconfigPath, project), project);
      expect([...files].filter((file) => file.endsWith('/types/validator.ts'))).toEqual([
        `${expectedOutput}/types/validator.ts`,
      ]);
      expect([...files].filter((file) => inventory.includes(file)).sort()).toEqual(productionSources);
      expect(files.has('next-env.d.ts')).toBe(true);
      expect([...files].filter(isTestOrFixture)).toEqual([]);
    },
  );

  it.each([false, true])('uses Next output paths for absolute DIST_DIR values, local=%s', (useLocalContracts) => {
    const project = fixtureProject();
    const distDir = join(dirname(project), 'absolute output');
    // Installed Next uses path.join(dir, config.distDir), then joins types/validator.ts.
    const output = join(project, distDir);
    for (const directory of [
      output,
      distDir,
      join(output, 'dev'),
      join(project, '.next'),
      join(project, '.next-local-contracts'),
    ]) {
      write(join(directory, 'types/validator.ts'), 'export {};\n');
    }
    write(join(project, 'app/page.ts'), 'export {};\n');
    write(join(project, 'app/page.test.ts'), 'export {};\n');
    write(join(project, 'scripts/tool.ts'), 'export {};\n');

    const selected = nextTypeScriptConfig({ rootDir: project, useLocalContracts, distDir });
    expect(selected.distDir).toBe(distDir);
    expect([...roots(parseConfig(selected.tsconfigPath, project), project)].sort()).toEqual(
      ['app/page.ts', `${portable(relative(project, output))}/types/validator.ts`].sort(),
    );
    const equivalent = nextTypeScriptConfig({
      rootDir: project,
      useLocalContracts,
      distDir: portable(relative(project, output)),
    });
    expect(equivalent.tsconfigPath).toBe(selected.tsconfigPath);
  });

  it.each(['tsconfig.local-contracts.json', 'tsconfig.app.local-contracts.json'])(
    '%s resolves all sibling source aliases and retains the application alias',
    (config) => {
      const project = fixtureProject();
      const aliases = [
        ['@echovisionlab/geul-common', '../geul-common/src/index.ts'],
        ['@echovisionlab/geul-common/sample', '../geul-common/src/sample.ts'],
        ['@echovisionlab/geul-event', '../geul-event-contracts/packages/event/src/index.ts'],
        ['@echovisionlab/geul-telemetry', '../geul-telemetry/src/index.ts'],
        ['@echovisionlab/geul-telemetry/sample', '../geul-telemetry/src/sample.ts'],
        [
          '@echovisionlab/geul-proto/common/sample',
          '../geul-event-contracts/packages/proto/gen/api/common/v1/sample.ts',
        ],
        [
          '@echovisionlab/geul-proto/content/sample',
          '../geul-event-contracts/packages/proto/gen/api/content/v1/sample.ts',
        ],
        ['@echovisionlab/geul-proto/intra/sample', '../geul-event-contracts/packages/proto/gen/api/intra/v1/sample.ts'],
        [
          '@echovisionlab/geul-proto/policy/sample',
          '../geul-event-contracts/packages/proto/gen/api/policy/v1/sample.ts',
        ],
        ['@echovisionlab/geul-proto/public/sample', '../geul-event-contracts/packages/proto/gen/api/open/v1/sample.ts'],
        [
          '@echovisionlab/geul-proto/secure/sample',
          '../geul-event-contracts/packages/proto/gen/api/manage/v1/sample.ts',
        ],
        ['@/theme', 'theme.ts'],
      ];
      for (const [, target] of aliases) {
        write(resolve(project, target), 'export {};\n');
      }
      const { options } = parseConfig(config, project);
      for (const [module, target] of aliases) {
        const result = ts.resolveModuleName(module, join(project, 'app/consumer.ts'), options, ts.sys);
        expect(result.resolvedModule?.resolvedFileName, module).toBe(resolve(project, target));
      }
    },
  );

  it('rejects a changed sibling contract with the same TS7 incremental cache', () => {
    const project = fixtureProject();
    const contract = resolve(project, '../geul-common/src/index.ts');
    write(contract, 'export type Contract = { value: string };\n');
    write(
      join(project, 'app/consumer.ts'),
      "import type { Contract } from '@echovisionlab/geul-common';\nexport const value: Contract = { value: 'valid' };\n",
    );
    write(
      join(project, 'tsconfig.fixture.json'),
      JSON.stringify({
        extends: './tsconfig.app.local-contracts.json',
        compilerOptions: { types: [], lib: ['es5'] },
      }),
    );
    const cli = join(dirname(require.resolve('typescript/package.json')), 'bin/tsc');
    const args = [cli, '--project', join(project, 'tsconfig.fixture.json'), '--pretty', 'false'];
    const first = spawnSync(process.execPath, args, { cwd: project, encoding: 'utf8' });
    expect(first.error).toBeUndefined();
    expect(first.status, first.stdout + first.stderr).toBe(0);
    expect(existsSync(join(project, '.cache/typescript/app-local-contracts.tsbuildinfo'))).toBe(true);

    write(contract, 'export type Contract = { value: number };\n');
    const second = spawnSync(process.execPath, args, { cwd: project, encoding: 'utf8' });
    expect(second.error).toBeUndefined();
    expect(second.status, second.stdout + second.stderr).toBeGreaterThan(0);
    expect(second.stdout).toContain('app/consumer.ts');
    expect(second.stdout).toContain('TS2322');
    expect(second.stdout).toContain("Type 'string' is not assignable to type 'number'");
  });
});
