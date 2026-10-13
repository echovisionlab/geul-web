import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  buildIdentity,
  criticalSnapshot,
  freshReport,
  loadPlan,
  projectPath,
  reportCounts,
  sourceReport,
  storyReport,
  tapCounts,
} from './review-data.mjs';
import { commands, inspectRun, recordReview, runReview, statusReview, verifyPreview } from './review.mjs';

const json = (file, value) => {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(value));
};
function fixture(t) {
  const root = mkdtempSync(path.join(tmpdir(), 'geul-review-test-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const put = (file, value) => json(path.join(root, file), value);
  const text = (file, value) => {
    mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    writeFileSync(path.join(root, file), value);
  };
  put('package.json', {});
  for (const [name, bin] of [
    ['vitest', 'vitest'],
    ['storybook', 'storybook'],
    ['@storybook/test-runner', 'test-storybook'],
    ['typescript', 'tsc'],
  ])
    put(`node_modules/${name}/package.json`, { name, bin: { [bin]: 'cli.js' } });
  text('components/Example.test.tsx', 'test source');
  text('scripts/design-system/example.test.mjs', 'node test source');
  text('components/Example.module.css', 'source style');
  const inventory = { manifestHash: 'source-manifest' };
  put('docs/design-system/ui-inventory.json', inventory);
  put('storybook-static/ui-kit-docs/design-system/ui-inventory.json', inventory);
  const index = {
    entries: {
      a: { type: 'story', title: 'Core/Example', name: 'First' },
      b: { type: 'story', title: 'Core/Example', name: 'Second' },
    },
  };
  put('storybook-static/index.json', index);
  text('storybook-static/iframe.html', '<html>compiled</html>');
  text('storybook-static/example.iframe.bundle.js', 'compiled code');
  put('design/storybook/review-notes/example.json', { observations: [{ result: 'Manual observation and its scope' }] });
  const plan = {
    schemaVersion: 1,
    title: 'Example review',
    scope: 'One shared owner',
    sourceTests: ['components/Example.test.tsx'],
    toolingTests: ['scripts/design-system'],
    criticalPaths: ['components'],
    manualNotes: 'design/storybook/review-notes/example.json',
    screenshots: [],
    boundaries: ['Fixture service only'],
  };
  put('design/storybook/review-plans/example.json', plan);
  const report = (name, titles = [['Source', 'Example']]) => ({
    success: true,
    startTime: Date.now(),
    numTotalTests: titles.length,
    numPassedTests: titles.length,
    numFailedTests: 0,
    numFailedTestSuites: 0,
    numPassedTestSuites: 99,
    testResults: [
      {
        name,
        status: 'passed',
        assertionResults: titles.map((ancestorTitles) => ({ status: 'passed', ancestorTitles })),
      },
    ],
  });
  const runner = async (args, log) => {
    text(path.relative(root, log), 'actual phase log');
    const output = args.includes('--outputFile')
      ? args[args.indexOf('--outputFile') + 1]
      : args.find((arg) => arg.startsWith('--outputFile='))?.slice('--outputFile='.length);
    if (output)
      json(
        output,
        args.includes('--index-json')
          ? report('generated-example.test.js', [
              ['Core/Example', 'First'],
              ['Core/Example', 'Second'],
            ])
          : report(path.join(root, 'components/Example.test.tsx')),
      );
    const tap = args
      .find((arg) => arg.startsWith('--test-reporter-destination='))
      ?.slice('--test-reporter-destination='.length);
    if (tap) writeFileSync(tap, '# tests 7\n# suites 0\n# pass 7\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n');
    return { code: 0, signal: null };
  };
  return { root, put, text, plan, report, index, runner };
}
test('plan names and project paths reject traversal, absolute paths and unknown plans', (t) => {
  const { root } = fixture(t);
  for (const name of ['../example', 'example.json', 'a/b', 'A', 'a--b', 'x'.repeat(65)])
    assert.throws(() => loadPlan(root, name));
  for (const file of ['../outside', '/absolute', 'a/../../b', 'a\\b']) assert.throws(() => projectPath(root, file));
  assert.throws(() => loadPlan(root, 'unknown'), /Unknown review plan/);
  assert.equal(loadPlan(root + path.sep, 'example').title, 'Example review');
  assert.equal(
    projectPath(root + path.sep, 'components/Example.test.tsx'),
    path.join(root, 'components/Example.test.tsx'),
  );
});
test('report totals count actual testResults files instead of Vitest describe-suite counters', (t) => {
  const { root, report } = fixture(t);
  const data = report(path.join(root, 'components/Example.test.tsx'));
  assert.deepEqual(sourceReport(data, ['components/Example.test.tsx'], root), {
    files: 1,
    tests: 1,
    passed: 1,
    failed: 0,
    skipped: 0,
  });
  assert.throws(() => sourceReport(data, ['missing.test.tsx'], root), /coverage/);
  for (const mutation of [
    { success: false },
    { numPendingTests: 1 },
    { wasInterrupted: true },
    { numTotalTests: 4 },
    { testResults: [] },
  ])
    assert.throws(() => reportCounts({ ...data, ...mutation }, 'Source'));
});
test('plan check environments cannot repurpose user home variables', (t) => {
  const f = fixture(t);
  for (const key of ['HOME', 'home', 'CODEX_HOME']) {
    f.put('design/storybook/review-plans/example.json', {
      ...f.plan,
      checks: [
        {
          name: 'extra',
          command: ['node', 'scripts/design-system/example.test.mjs'],
          env: { [key]: 'another-directory' },
        },
      ],
    });
    assert.throws(() => loadPlan(f.root, 'example'), /environment/);
  }
});
test('official story runner receives separate Commander outputFile tokens, without changing Vitest syntax', (t) => {
  const f = fixture(t);
  const phases = commands(f.root, loadPlan(f.root, 'example'), path.join(f.root, '.artifacts/review'));
  const stories = phases.find((phase) => phase.name === 'storybook-tests');
  const output = stories.args.indexOf('--outputFile');
  assert.ok(output >= 0);
  assert.equal(stories.args[output + 1], path.join(f.root, '.artifacts/review/storybook-tests.json'));
  // This runner forwards outputFile as a boolean, then appends positional values to Jest.
  assert.equal(output + 2, stories.args.length);
  assert.equal(
    stories.args.some((arg) => arg.startsWith('--outputFile=')),
    false,
  );
  assert.ok(phases.find((phase) => phase.name === 'source-tests').args.some((arg) => arg.startsWith('--outputFile=')));
});
test('full browser coverage rejects a passing filtered story report', (t) => {
  const { report, index } = fixture(t);
  assert.throws(() => storyReport(report('story.test.js', [['Core/Example', 'First']]), index), /coverage/);
  assert.equal(
    storyReport(
      report('story.test.js', [
        ['Core/Example', 'First'],
        ['Core/Example', 'Second'],
      ]),
      index,
    ).stories,
    2,
  );
});
test('tooling counts come from completed native TAP and reject skips or missing summaries', () => {
  const tap = '# tests 11\n# suites 0\n# pass 11\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n';
  assert.equal(tapCounts(tap).tests, 11);
  assert.throws(() => tapCounts(tap.replace('# skipped 0', '# skipped 1')));
  assert.throws(() => tapCounts(tap.replace('# tests 11', '')));
});
test('capture identifies CSS/build changes and rejects mismatched source/build inventories', (t) => {
  const f = fixture(t);
  const plan = loadPlan(f.root, 'example');
  const before = buildIdentity(f.root, plan);
  f.text('components/Example.module.css', 'changed source style');
  assert.notDeepEqual(criticalSnapshot(f.root, plan), before.critical);
  f.put('storybook-static/ui-kit-docs/design-system/ui-inventory.json', { manifestHash: 'older' });
  assert.throws(() => buildIdentity(f.root, plan), /manifest mismatch/);
});
test('preview must serve the current built index, with an actionable offline message', async (t) => {
  const { root, index } = fixture(t);
  const plan = loadPlan(root, 'example');
  await verifyPreview(root, plan, async (url) => ({
    ok: true,
    json: async () => index,
    text: async () => readFileSync(path.join(root, 'storybook-static', new URL(url).pathname), 'utf8'),
  }));
  await assert.rejects(
    verifyPreview(root, plan, async () => ({ ok: true, json: async () => ({ entries: {} }) })),
    /Preview\/built index/,
  );
  await assert.rejects(
    verifyPreview(root, plan, async () => {
      throw new Error('offline');
    }),
    /serve-kit/,
  );
});
test('run/record/status preserve boundaries, histories and real counts; stale source cannot be published', async (t) => {
  const f = fixture(t);
  await runReview(f.root, 'example', f.runner, async () => {});
  const result = recordReview(f.root, 'example');
  assert.equal(result.status, 'ready_for_review');
  assert.equal(result.checks.source.files, 1);
  assert.equal(result.checks.tooling.tests, 7);
  assert.equal(result.checks.stories.stories, 2);
  assert.deepEqual(result.boundaries, f.plan.boundaries);
  assert.equal(statusReview(f.root, 'example').status, 'passed');
  f.text('components/Example.module.css', 'CSS changed after build');
  assert.throws(() => recordReview(f.root, 'example'), /identity/);
  assert.equal(statusReview(f.root, 'example').status, 'stale');
  assert.equal(JSON.parse(readFileSync(path.join(f.root, 'design/storybook/example-review.json'))).runId, result.runId);
  await runReview(f.root, 'example', f.runner, async () => {});
  assert.notEqual(inspectRun(f.root, 'example').state.runId, result.runId);
});
test('a failed phase leaves inspectable state and prevents record', async (t) => {
  const f = fixture(t);
  await assert.rejects(
    runReview(
      f.root,
      'example',
      async (_args, log) => {
        writeFileSync(log, 'failure');
        return { code: 1, signal: null };
      },
      async () => {},
    ),
    /generate failed/,
  );
  assert.equal(statusReview(f.root, 'example').status, 'failed');
  assert.throws(() => recordReview(f.root, 'example'), /incomplete or failing/);
});
test('record rejects changed logs, empty manual observations and stale JSON startTime', async (t) => {
  const f = fixture(t);
  await runReview(f.root, 'example', f.runner, async () => {});
  f.put(f.plan.manualNotes, { observations: [] });
  assert.throws(() => recordReview(f.root, 'example'), /Manual notes/);
  f.text('.artifacts/design-system/reviews/example/source-tests.log', 'changed log');
  assert.throws(() => inspectRun(f.root, 'example'), /Changed report\/log/);
  assert.throws(
    () =>
      freshReport(
        path.join(f.root, 'package.json'),
        { name: 'source', startedAt: new Date().toISOString(), finishedAt: new Date().toISOString() },
        { startTime: 0 },
      ),
    /Stale report/,
  );
});
