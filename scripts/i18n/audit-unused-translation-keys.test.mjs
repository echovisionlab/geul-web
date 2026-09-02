import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, realpath, rm, stat, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { runAudit } from './audit-unused-translation-keys.mjs';

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

async function makeFixture() {
  const root = await mkdtemp(join(tmpdir(), 'i18n-audit-fixture-'));
  await mkdir(join(root, 'messages'));
  const messages = {
    common: { used: 'Used', unused: 'Unused' },
    admin: { unused: 'Unused admin' },
  };
  const declaration = [
    "import messages from '@/messages/en.json';",
    '',
    "declare module 'next-intl' {",
    '  interface AppConfig { Messages: typeof messages; }',
    '}',
    '',
  ].join('\n');
  await Promise.all([
    writeFile(join(root, 'messages/en.json'), `${JSON.stringify(messages, null, 2)}\n`),
    writeFile(join(root, 'global.d.ts'), declaration),
    writeFile(join(root, 'source.ts'), "export const source = 'fixture';\n"),
    writeFile(join(root, 'tsconfig.json'), '{}\n'),
    writeFile(join(root, 'package.json'), '{"private":true}\n'),
  ]);
  return { root, messages, declaration };
}

function fixtureProject(root) {
  return {
    compilerPath: join(root, 'fake-tsc'),
    compilerVersion: 'fixture',
    compilerOptions: { strict: true },
    projectReferences: [],
    rootFileNames: [join(root, 'global.d.ts'), join(root, 'source.ts')],
  };
}

async function makeTypeScriptFixture({ broadEscape = false, broadCatalogEscape = false } = {}) {
  const root = await mkdtemp(join(tmpdir(), 'i18n-audit-typescript-fixture-'));
  await mkdir(join(root, 'messages'), { recursive: true });
  const messages = {
    common: { direct: 'Direct import', unused: 'Unused', used: 'Translator alias' },
  };
  const source = [
    "import directMessages from '@/messages/en.json';",
    "import { useTranslations } from 'next-intl';",
    '',
    "const translate = useTranslations('common');",
    "function consume(t: typeof translate, key: 'used') {",
    '  return t(key);',
    '}',
    "export const translated = consume(translate, 'used');",
    'export const direct = directMessages.common.direct;',
    broadEscape ? 'export const unsafe = ((t: (key: string) => string) => t)(translate);' : '',
    broadCatalogEscape ? 'export const unsafeMessages: Record<string, unknown> = directMessages;' : '',
    '',
  ].join('\n');
  const nextIntl = [
    "declare module 'next-intl' {",
    '  interface AppConfig {}',
    '  type ConfiguredMessages = AppConfig extends { Messages: infer Value } ? Value : never;',
    '  export function useTranslations<Namespace extends keyof ConfiguredMessages & string>(',
    '    namespace: Namespace,',
    '  ): <Key extends keyof ConfiguredMessages[Namespace] & string>(key: Key) => string;',
    '}',
    '',
  ].join('\n');
  const declaration = [
    "import messages from '@/messages/en.json';",
    '',
    "declare module 'next-intl' {",
    '  interface AppConfig { Messages: typeof messages; }',
    '}',
    '',
  ].join('\n');
  const tsconfig = {
    compilerOptions: {
      strict: true,
      noEmit: true,
      module: 'esnext',
      moduleResolution: 'bundler',
      resolveJsonModule: true,
      target: 'es2022',
      paths: {
        'next-intl': ['./next-intl.d.ts'],
        '@/*': ['./*'],
      },
    },
    include: ['**/*.ts', '**/*.d.ts'],
    exclude: ['node_modules'],
  };
  await Promise.all([
    writeFile(join(root, 'messages/en.json'), `${JSON.stringify(messages, null, 2)}\n`),
    writeFile(join(root, 'global.d.ts'), declaration),
    writeFile(join(root, 'next-intl.d.ts'), nextIntl),
    writeFile(join(root, 'source.ts'), source),
    writeFile(join(root, 'tsconfig.json'), `${JSON.stringify(tsconfig, null, 2)}\n`),
    writeFile(join(root, 'package.json'), '{"private":true}\n'),
  ]);
  return root;
}

test('batches by namespace, splits failures, runs sequentially, and cleans its temporary project', async () => {
  const fixture = await makeFixture();
  const invocations = [];
  const checkpoint = join(fixture.root, '.cache/audit.jsonl');
  let active = 0;
  let maximumActive = 0;
  let audit;
  const canonicalFixtureRoot = await realpath(fixture.root);
  const executeCompiler = async ({ command, args, cwd, candidatePaths, tempRoot }) => {
    active += 1;
    maximumActive = Math.max(maximumActive, active);
    try {
      assert.equal(command, process.execPath);
      assert.equal(cwd, canonicalFixtureRoot);
      assert.deepEqual(args.slice(1), ['--project', join(tempRoot, 'tsconfig.json'), '--pretty', 'false']);
      const candidateMessages = JSON.parse(await readFile(join(tempRoot, 'candidate-messages.json'), 'utf8'));
      for (const key of candidatePaths) {
        const value = key.split('.').reduce((parent, segment) => parent?.[segment], candidateMessages);
        assert.equal(value, undefined, `${key} should be absent from the temporary schema`);
      }
      invocations.push(candidatePaths);
      await Promise.resolve();
      return {
        code:
          candidatePaths.includes('common.used') ||
          (candidatePaths.includes('common.unused') && candidatePaths.includes('admin.unused'))
            ? 1
            : 0,
        signal: null,
        stdout: '',
        stderr: '',
      };
    } finally {
      active -= 1;
    }
  };
  try {
    audit = await runAudit({
      repoRoot: fixture.root,
      checkpoint,
      stderr: { write() {} },
      loadProject: async () => fixtureProject(fixture.root),
      preflight() {},
      executeCompiler,
    });

    assert.deepEqual(audit.result, ['admin.unused']);
    assert.deepEqual(invocations[0], []);
    assert.ok(invocations.some((keys) => ['common.unused', 'common.used'].every((key) => keys.includes(key))));
    assert.equal(maximumActive, 1);
    assert.equal(await exists(audit.tempRoot), false);
    assert.equal(
      await readFile(join(fixture.root, 'messages/en.json'), 'utf8'),
      `${JSON.stringify(fixture.messages, null, 2)}\n`,
    );
    assert.equal(await readFile(join(fixture.root, 'global.d.ts'), 'utf8'), fixture.declaration);

    invocations.length = 0;
    const resumed = await runAudit({
      repoRoot: fixture.root,
      checkpoint,
      stderr: { write() {} },
      loadProject: async () => fixtureProject(fixture.root),
      preflight() {},
      executeCompiler,
    });
    assert.deepEqual(resumed.result, audit.result);
    assert.deepEqual(invocations, [[]], 'a matching checkpoint should leave only the mandatory baseline compile');
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

test('cleans its temporary project and preserves inputs when compiler orchestration throws', async () => {
  const fixture = await makeFixture();
  let observedTempRoot;
  try {
    await assert.rejects(
      runAudit({
        repoRoot: fixture.root,
        checkpoint: false,
        stderr: { write() {} },
        loadProject: async () => fixtureProject(fixture.root),
        preflight() {},
        executeCompiler: async ({ tempRoot }) => {
          observedTempRoot = tempRoot;
          throw new Error('fixture compiler failure');
        },
      }),
      /fixture compiler failure/,
    );

    assert.equal(await exists(observedTempRoot), false);
    assert.equal(
      await readFile(join(fixture.root, 'messages/en.json'), 'utf8'),
      `${JSON.stringify(fixture.messages, null, 2)}\n`,
    );
    assert.equal(await readFile(join(fixture.root, 'global.d.ts'), 'utf8'), fixture.declaration);
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

test('real TypeScript redirects direct English imports and follows a typed alias parameter', async () => {
  const root = await makeTypeScriptFixture();
  try {
    const audit = await runAudit({
      repoRoot: root,
      checkpoint: false,
      stderr: { write() {} },
    });
    assert.deepEqual(audit.result, ['common.unused']);
    assert.equal(await exists(audit.tempRoot), false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('checker preflight refuses a next-intl translator widened to string', async () => {
  const root = await makeTypeScriptFixture({ broadEscape: true });
  try {
    await assert.rejects(
      runAudit({
        repoRoot: root,
        checkpoint: false,
        stderr: { write() {} },
      }),
      /safety preflight failed[\s\S]*key domain is string/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('checker preflight refuses an English catalog widened to a broad Record', async () => {
  const root = await makeTypeScriptFixture({ broadCatalogEscape: true });
  try {
    await assert.rejects(
      runAudit({
        repoRoot: root,
        checkpoint: false,
        stderr: { write() {} },
      }),
      /safety preflight failed[\s\S]*widens its exact message shape/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('canonical containment rejects a repository cache symlink that escapes the root', async () => {
  const fixture = await makeFixture();
  const outside = await mkdtemp(join(tmpdir(), 'i18n-audit-outside-'));
  try {
    await symlink(outside, join(fixture.root, '.cache'));
    await assert.rejects(
      runAudit({
        repoRoot: fixture.root,
        loadProject: async () => fixtureProject(fixture.root),
        preflight() {},
        executeCompiler: async () => ({ code: 0, signal: null, stdout: '', stderr: '' }),
      }),
      /checkpoint must be inside the repository/,
    );
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
    await rm(outside, { recursive: true, force: true });
  }
});

test('canonical containment rejects dangling symlink components for output, checkpoint, and temp', async () => {
  const fixture = await makeFixture();
  const dangling = join(fixture.root, 'dangling');
  await symlink(join(fixture.root, 'missing-target'), dangling);
  const common = {
    repoRoot: fixture.root,
    checkpoint: false,
    loadProject: async () => fixtureProject(fixture.root),
    preflight() {},
    executeCompiler: async () => ({ code: 0, signal: null, stdout: '', stderr: '' }),
  };
  try {
    await assert.rejects(runAudit({ ...common, output: 'dangling/output.json' }), /dangling symlink/);
    await assert.rejects(runAudit({ ...common, checkpoint: 'dangling/checkpoint.json' }), /dangling symlink/);
    await assert.rejects(
      runAudit({ ...common, makeTempDirectory: async () => join(dangling, 'temp') }),
      /dangling symlink/,
    );
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});
