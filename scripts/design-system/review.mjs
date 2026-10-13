#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import {
  closeSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  renameSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import {
  buildIdentity,
  criticalSnapshot,
  freshReport,
  loadPlan,
  projectPath,
  readJson,
  reportCounts,
  sameSnapshot,
  sha256,
  sourceReport,
  storyReport,
  tapCounts,
} from './review-data.mjs';

const root = path.resolve(fileURLToPath(new URL('../../', import.meta.url)));
const timestamp = () => new Date().toISOString();
const save = (file, value) => {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(`${file}.tmp`, JSON.stringify(value, null, 2) + '\n');
  renameSync(`${file}.tmp`, file);
};
const workFor = (root, name) => projectPath(root, `.artifacts/design-system/reviews/${name}`);
const cliFile = (root, packageName, command) => {
  const require = createRequire(path.join(root, 'package.json'));
  const file = require.resolve(`${packageName}/package.json`);
  const pkg = readJson(file);
  const bin = typeof pkg.bin === 'string' ? pkg.bin : pkg.bin[command];
  if (!bin) throw new Error(`Missing installed CLI: ${command}`);
  return path.resolve(path.dirname(file), bin);
};
export function commands(root, plan, work) {
  return [
    { name: 'generate', args: ['scripts/design-system/validate.mjs', '--generate'] },
    {
      name: 'source-tests',
      args: [
        cliFile(root, 'vitest', 'vitest'),
        'run',
        ...plan.sourceTests,
        '--maxWorkers',
        '2',
        '--reporter=json',
        `--outputFile=${path.join(work, 'source-tests.json')}`,
      ],
      report: 'source-tests.json',
    },
    {
      name: 'tooling-tests',
      args: [
        '--test',
        '--test-reporter=tap',
        `--test-reporter-destination=${path.join(work, 'tooling-tests.tap')}`,
        ...plan.toolingTests,
      ],
      report: 'tooling-tests.tap',
    },
    ...plan.checks.map((check) => ({ name: `checks/${check.name}`, args: check.command.slice(1), env: check.env })),
    { name: 'check', args: ['scripts/design-system/validate.mjs'] },
    {
      name: 'storybook-types',
      args: [cliFile(root, 'typescript', 'tsc'), '--noEmit', '--project', '.storybook/tsconfig.json'],
    },
    {
      name: 'build',
      args: [cliFile(root, 'storybook', 'storybook'), 'build'],
      env: { UI_KIT_MINIFY: plan.minify ? '1' : '0' },
    },
    {
      name: 'storybook-tests',
      args: [
        cliFile(root, '@storybook/test-runner', 'test-storybook'),
        '--index-json',
        '--url',
        plan.url,
        '--maxWorkers',
        '2',
        '--json',
        '--outputFile',
        path.join(work, 'storybook-tests.json'),
      ],
      report: 'storybook-tests.json',
    },
  ];
}
async function execute(args, log, env) {
  mkdirSync(path.dirname(log), { recursive: true });
  const fd = openSync(log, 'w');
  try {
    return await new Promise((resolve, reject) => {
      const child = spawn(process.execPath, args, {
        cwd: root,
        env: { ...process.env, ...env },
        shell: false,
        stdio: ['ignore', fd, fd],
      });
      child.once('error', reject);
      child.once('close', (code, signal) => resolve({ code, signal }));
    });
  } finally {
    closeSync(fd);
  }
}
export async function verifyPreview(root, plan, fetchPreview = fetch) {
  let response;
  try {
    response = await fetchPreview(`${plan.url}/index.json`, { signal: AbortSignal.timeout(10_000), cache: 'no-store' });
  } catch {
    throw new Error(
      `Preview unavailable. Run node scripts/design-system/serve-kit.mjs in another terminal, then rerun this review (${plan.url}).`,
    );
  }
  if (!response.ok)
    throw new Error(
      `Preview returned ${response.status}; serve the current storybook-static build with serve-kit.mjs.`,
    );
  const served = await response.json();
  const built = readJson(projectPath(root, 'storybook-static/index.json'));
  const canonical = (value) =>
    value && typeof value === 'object'
      ? Array.isArray(value)
        ? value.map(canonical)
        : Object.fromEntries(
            Object.keys(value)
              .sort()
              .map((key) => [key, canonical(value[key])]),
          )
      : value;
  sameSnapshot(canonical(served), canonical(built), 'Preview/built index');
  for (const file of ['iframe.html', 'ui-kit-docs/design-system/ui-inventory.json']) {
    const response = await fetchPreview(`${plan.url}/${file}`, {
      signal: AbortSignal.timeout(10_000),
      cache: 'no-store',
    });
    if (!response.ok)
      throw new Error(`Preview build file unavailable: ${file}. Restart serve-kit.mjs for the current build.`);
    const hash = createHash('sha256')
      .update(await response.text())
      .digest('hex');
    if (hash !== sha256(projectPath(root, `storybook-static/${file}`)))
      throw new Error(`Preview is serving a stale build: ${file}. Restart serve-kit.mjs.`);
  }
}
export async function runReview(root, name, runner = execute, preview = verifyPreview) {
  if (process.env.LOCAL_CONTRACTS === '1')
    throw new Error('Unset LOCAL_CONTRACTS before this installed-contract review.');
  const plan = loadPlan(root, name);
  const work = workFor(root, name);
  mkdirSync(work, { recursive: true });
  const existing = readdirSync(work).filter((file) => file !== 'history');
  if (existing.length) {
    const archive = path.join(work, 'history', `${Date.now()}-${randomUUID().slice(0, 8)}`);
    mkdirSync(archive, { recursive: true });
    existing.forEach((file) => renameSync(path.join(work, file), path.join(archive, file)));
  }
  const state = {
    schemaVersion: 1,
    name,
    runId: randomUUID(),
    planHash: plan.planHash,
    startedAt: timestamp(),
    status: 'running',
    steps: [],
  };
  const stateFile = path.join(work, 'run.json');
  save(stateFile, state);
  try {
    for (const command of commands(root, plan, work)) {
      if (command.name === 'storybook-tests') await preview(root, plan);
      const log = `${command.name}.log`;
      const step = {
        name: command.name,
        startedAt: timestamp(),
        status: 'running',
        command: ['node', ...command.args],
        env: command.env ?? {},
        log,
        ...(command.report ? { report: command.report } : {}),
      };
      state.steps.push(step);
      save(stateFile, state);
      console.log(`${command.name}: running → ${path.relative(root, path.join(work, log))}`);
      const result = await runner(command.args, path.join(work, log), command.env);
      step.finishedAt = timestamp();
      step.exitCode = result.code;
      step.signal = result.signal;
      if (result.code !== 0 || result.signal)
        throw new Error(`${command.name} failed; read ${path.relative(root, path.join(work, log))}.`);
      if (command.report)
        freshReport(
          path.join(work, command.report),
          step,
          command.report.endsWith('.json') ? readJson(path.join(work, command.report)) : undefined,
        );
      if (command.name === 'source-tests')
        step.counts = sourceReport(readJson(path.join(work, command.report)), plan.sourceTests, root);
      if (command.name === 'tooling-tests')
        step.counts = tapCounts(readFileSync(path.join(work, command.report), 'utf8'));
      if (command.name === 'storybook-tests')
        step.counts = storyReport(
          readJson(path.join(work, command.report)),
          readJson(projectPath(root, 'storybook-static/index.json')),
        );
      step.status = 'passed';
      step.hashes = Object.fromEntries(
        [log, ...(command.report ? [command.report] : [])].map((file) => [file, sha256(path.join(work, file))]),
      );
      if (command.name === 'generate') state.critical = criticalSnapshot(root, plan);
      if (command.name === 'build') {
        const identity = buildIdentity(root, plan);
        sameSnapshot(identity.critical, state.critical, 'Source during validation/build');
        save(path.join(work, 'build-identity.json'), identity);
        state.buildIdentitySha256 = sha256(path.join(work, 'build-identity.json'));
      }
      save(stateFile, state);
      console.log(`${command.name}: passed${step.counts ? ` (${step.counts.tests} tests)` : ''}`);
    }
    state.status = 'passed';
    state.finishedAt = timestamp();
    save(stateFile, state);
    console.log(
      `Run complete. Inspect manual notes/screenshots, then: node scripts/design-system/review.mjs record ${name}`,
    );
    return state;
  } catch (error) {
    const step = state.steps.at(-1);
    if (step?.status === 'running') step.status = 'failed';
    state.status = 'failed';
    state.finishedAt = timestamp();
    state.error = error.message;
    save(stateFile, state);
    throw error;
  }
}
export function inspectRun(root, name) {
  const plan = loadPlan(root, name);
  const work = workFor(root, name);
  if (!existsSync(path.join(work, 'run.json')))
    throw new Error('No reusable review run exists yet. Run this plan first.');
  const state = readJson(path.join(work, 'run.json'));
  if (state.schemaVersion !== 1 || state.name !== name || state.planHash !== plan.planHash || state.status !== 'passed')
    throw new Error('Run is stale, incomplete or failing. Rerun this plan.');
  const expectedCommands = commands(root, plan, work);
  const phases = expectedCommands.map((step) => step.name);
  sameSnapshot(
    state.steps?.map((step) => step.name),
    phases,
    'Executed phases',
  );
  for (const step of state.steps) {
    const expected = expectedCommands.find((command) => command.name === step.name);
    sameSnapshot(step.command, ['node', ...expected.args], `${step.name} command`);
    sameSnapshot(step.env, expected.env ?? {}, `${step.name} environment`);
    if (
      step.status !== 'passed' ||
      step.exitCode !== 0 ||
      step.signal ||
      !step.finishedAt ||
      !step.hashes?.[step.log] ||
      (step.report && !step.hashes[step.report])
    )
      throw new Error(`Incomplete phase: ${step.name}`);
    for (const [file, hash] of Object.entries(step.hashes)) {
      const absolute = projectPath(root, path.relative(root, path.join(work, file)));
      if (sha256(absolute) !== hash) throw new Error(`Changed report/log: ${file}`);
    }
    if (step.report)
      freshReport(
        path.join(work, step.report),
        step,
        step.report.endsWith('.json') ? readJson(path.join(work, step.report)) : undefined,
      );
  }
  const identityFile = path.join(work, 'build-identity.json');
  if (sha256(identityFile) !== state.buildIdentitySha256) throw new Error('Captured build identity changed.');
  const identity = readJson(identityFile);
  sameSnapshot(buildIdentity(root, plan), identity, 'Captured source/build identity');
  sameSnapshot(identity.critical, state.critical, 'Tested source');
  const source = sourceReport(readJson(path.join(work, 'source-tests.json')), plan.sourceTests, root);
  const tooling = {
    files: plan.toolingTests.length,
    ...tapCounts(readFileSync(path.join(work, 'tooling-tests.tap'), 'utf8')),
  };
  const stories = storyReport(
    readJson(path.join(work, 'storybook-tests.json')),
    readJson(projectPath(root, 'storybook-static/index.json')),
  );
  return { plan, work, state, identity, counts: { source, tooling, stories } };
}
export function recordReview(root, name) {
  const { plan, work, state, identity, counts } = inspectRun(root, name);
  const manualFile = projectPath(root, plan.manualNotes);
  const manual = readJson(manualFile);
  if (!Array.isArray(manual.observations) || !manual.observations.length)
    throw new Error('Manual notes must contain a nonempty observations array.');
  const screenshots = (plan.screenshots ?? []).map((file) => ({ path: file, sha256: sha256(projectPath(root, file)) }));
  const priorRuns = (plan.priorRuns ?? []).map((file) => {
    let counts;
    try {
      counts = reportCounts(readJson(projectPath(root, file)), 'Historical report');
    } catch {
      /* Failed historical reports/logs are preserved, never counted as acceptance. */
    }
    return { path: file, sha256: sha256(projectPath(root, file)), ...(counts ? { counts } : {}) };
  });
  const record = {
    schemaVersion: 1,
    name,
    title: plan.title,
    status: 'ready_for_review',
    recordedAt: timestamp(),
    runId: state.runId,
    scope: plan.scope,
    plan: { path: plan.planFile, sha256: plan.planHash },
    checks: counts,
    phases: state.steps,
    buildIdentity: identity,
    manualReview: { path: plan.manualNotes, sha256: sha256(manualFile), notes: manual },
    screenshots,
    priorRuns,
    boundaries: plan.boundaries,
    workDirectory: path.relative(root, work),
  };
  const file = projectPath(root, `design/storybook/${name}-review.json`);
  if (existsSync(file)) {
    const archive = path.join(work, 'history', `record-${Date.now()}-${randomUUID().slice(0, 8)}.json`);
    mkdirSync(path.dirname(archive), { recursive: true });
    copyFileSync(file, archive);
  }
  save(file, record);
  console.log(
    `Recorded ready_for_review → ${path.relative(root, file)} (${counts.source.files} source files/${counts.source.tests} tests; ${counts.stories.stories} stories)`,
  );
  return record;
}
export function statusReview(root, name) {
  const plan = loadPlan(root, name);
  const work = workFor(root, name);
  const file = path.join(work, 'run.json');
  if (!existsSync(file)) return { name, status: 'not_run', plan: plan.planFile };
  const run = readJson(file);
  const summary = {
    name,
    status: run.status,
    startedAt: run.startedAt,
    finishedAt: run.finishedAt,
    steps: run.steps.map(({ name, status, log, counts }) => ({
      name,
      status,
      log: path.relative(root, path.join(work, log)),
      counts,
    })),
  };
  if (run.status === 'passed') {
    try {
      summary.counts = inspectRun(root, name).counts;
    } catch (error) {
      summary.status = 'stale';
      summary.reason = error.message;
    }
  }
  if (run.error) summary.reason = run.error;
  return summary;
}
export async function main(args) {
  if (!args.length || args[0] === '--help' || args[0] === 'help') {
    console.log(
      'Design-system review\n\n  node scripts/design-system/review.mjs run <name>\n  node scripts/design-system/review.mjs record <name>\n  node scripts/design-system/review.mjs status <name>\n\nPlans: design/storybook/review-plans/<name>.json\nLogs: .artifacts/design-system/reviews/<name>/\nGuide: docs/design-system/review-tools.md',
    );
    return;
  }
  if (args.length !== 2 || !['run', 'record', 'status'].includes(args[0]))
    throw new Error('Use run, record or status with one review name. See --help.');
  if (args[0] === 'run') await runReview(root, args[1]);
  else if (args[0] === 'record') recordReview(root, args[1]);
  else console.log(JSON.stringify(statusReview(root, args[1]), null, 2));
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  main(process.argv.slice(2)).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
