#!/usr/bin/env node
// Run one build's stories as independent Jest files and browser contexts.
// pnpm storybook:test:ci --suite author --shard 1/2 --static-dir storybook-static
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startKitServer } from '../design-system/serve-kit.mjs';
import { createEmailPreviewHandler } from '../design-system/email-preview-handler.mjs';
import {
  browserWorkerCount,
  isStorybookCI,
  selectBrowserStories,
  shardBrowserStories,
} from './storybook-browser-plan.mjs';
import { browserStorySource } from './storybook-test-files.mjs';

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(name);
  if (index === -1) return fallback;
  if (!args[index + 1] || args[index + 1].startsWith('--')) throw new Error(`Missing ${name} value`);
  return args[index + 1];
};
const suite = option('--suite', 'all');
if (!['all', 'a11y', 'author', 'email-rendering'].includes(suite)) throw new Error(`Unknown Storybook suite: ${suite}`);
const shard = option('--shard', '1/1');
if (!/^[1-9]\d*\/[1-9]\d*$/.test(shard)) throw new Error('Expected --shard index/count');
const [shardIndex, shardCount] = shard.split('/').map(Number);
if (shardIndex > shardCount) throw new Error('Shard index exceeds count');
const ci = isStorybookCI(process.env);
const workers = browserWorkerCount(ci);
const artifactRoot = resolve('.artifacts/storybook');
await mkdir(artifactRoot, { recursive: true });
const output = await mkdtemp(join(artifactRoot, `${suite}-${shard.replace('/', '-')}-`));
const cases = join(output, 'cases');
const contexts = join(output, 'contexts');
await mkdir(cases);
await mkdir(contexts);
let preview;
let child;
let stopping = false;
const stopChild = () => {
  stopping = true;
  if (child?.pid && child.exitCode === null && child.signalCode === null) {
    try {
      if (process.platform === 'win32') child.kill('SIGTERM');
      else process.kill(-child.pid, 'SIGTERM');
    } catch (error) {
      if (error.code !== 'ESRCH') throw error;
    }
  }
};
process.once('SIGINT', stopChild);
process.once('SIGTERM', stopChild);

try {
  const directory = option('--static-dir', 'storybook-static');
  preview = await startKitServer({ directory, handleRequest: createEmailPreviewHandler({ maxConcurrent: workers }) });
  const response = await fetch(new URL('index.json', preview.url), { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`Storybook index responded ${response.status}`);
  const stories = selectBrowserStories(await response.json(), suite);
  if (stories.length < shardCount) throw new Error(`Suite ${suite} has fewer stories than shards`);
  const assignedStories = shardBrowserStories(stories, shardIndex, shardCount);
  await Promise.all(
    assignedStories.map((story) => writeFile(join(cases, `${story.id}.test.js`), browserStorySource(story))),
  );
  const plan = {
    suite,
    shard,
    ci,
    availableParallelism: ci ? workers : null,
    resolvedMaxWorkers: workers,
    selectedStories: stories.length,
    generatedTestFiles: assignedStories.length,
    url: preview.url,
    output,
    selectedStoryIds: stories.map((story) => story.id),
    storyIds: assignedStories.map((story) => story.id),
  };
  console.log(JSON.stringify(plan, null, 2));
  await writeFile(join(output, 'plan.json'), JSON.stringify(plan, null, 2));
  if (stopping) throw new Error('Storybook browser run cancelled');

  const require = createRequire(import.meta.url);
  const runnerRequire = createRequire(require.resolve('@storybook/test-runner/package.json'));
  const jestBin = join(resolve(runnerRequire.resolve('jest/package.json'), '..'), 'bin/jest.js');
  const resultFile = join(output, 'results.json');
  const jestArguments = [
    '--experimental-vm-modules',
    jestBin,
    '--config',
    fileURLToPath(new URL('../../.storybook/test-runner-jest.config.mjs', import.meta.url)),
    '--maxWorkers',
    String(workers),
    ...(suite === 'email-rendering' ? ['--testTimeout', '60000'] : []),
    '--cacheDirectory',
    join(output, 'cache'),
    ...(ci ? ['--ci'] : []),
  ];
  const jestEnvironment = {
    ...process.env,
    NODE_ENV: 'test',
    BABEL_ENV: 'test',
    PUBLIC_URL: '',
    STORYBOOK_TEST_RUNNER: 'true',
    STORYBOOK_CONFIG_DIR: '.storybook',
    TEST_ROOT: cases,
    TEST_MATCH: '**/*.test.js',
    TEST_BROWSERS: 'chromium',
    TARGET_URL: preview.url,
    VIEW_MODE: 'story',
    STORYBOOK_ISOLATED_CI: ci ? 'true' : 'false',
    STORYBOOK_TEST_RESULT_DIR: contexts,
  };
  const executeJest = async (extraArguments, capture = false) => {
    if (stopping) throw new Error('Storybook browser run cancelled');
    child = spawn(process.execPath, [...jestArguments, ...extraArguments], {
      stdio: capture ? ['ignore', 'pipe', 'inherit'] : 'inherit',
      detached: process.platform !== 'win32',
      env: jestEnvironment,
    });
    let stdout = '';
    if (capture)
      child.stdout.on('data', (chunk) => {
        stdout += chunk;
      });
    return Promise.race([
      new Promise((resolveExit, reject) => {
        child.once('error', reject);
        child.once('exit', (code) => resolveExit({ code: code ?? 1, stdout }));
      }),
      preview.failure.then((error) => {
        throw error;
      }),
    ]);
  };
  // Query the same installed Jest CLI/config before launching workers; the log
  // records the resolved value rather than assuming CLI precedence worked.
  const configuration = await executeJest(['--showConfig'], true);
  if (configuration.code !== 0) throw new Error('Could not resolve Storybook Jest configuration');
  const resolvedWorkers = JSON.parse(configuration.stdout).globalConfig.maxWorkers;
  if (resolvedWorkers !== workers) throw new Error(`Jest resolved ${resolvedWorkers} workers, expected ${workers}`);
  await writeFile(
    join(output, 'workers.json'),
    JSON.stringify({ availableParallelism: ci ? workers : null, resolvedMaxWorkers: resolvedWorkers }, null, 2),
  );
  console.log(
    `Storybook Jest resolved maxWorkers=${resolvedWorkers}${ci ? ` (availableParallelism=${workers})` : ' (local limit)'}`,
  );

  const { code: exitCode } = await executeJest(['--json', '--outputFile', resultFile]);
  process.exitCode = exitCode;
  const records = await Promise.all(
    (await readdir(contexts))
      .filter((file) => file.endsWith('.json'))
      .map(async (file) => JSON.parse(await readFile(join(contexts, file), 'utf8'))),
  );
  const workerIds = [...new Set(records.map((record) => record.workerId))];
  const execution = {
    suite,
    shard,
    resolvedMaxWorkers: workers,
    completedStories: records.length,
    workerIds,
    contextIds: records.map((record) => record.contextId),
    allContextsClosed: records.every((record) => record.closed),
    freshStorage: records.every((record) => record.storageWasEmpty),
    exitCode,
  };
  await writeFile(join(output, 'execution.json'), JSON.stringify(execution, null, 2));
  console.log(JSON.stringify(execution, null, 2));
  if (exitCode === 0) {
    const results = JSON.parse(await readFile(resultFile, 'utf8'));
    if (
      records.length !== assignedStories.length ||
      results.numTotalTestSuites !== assignedStories.length ||
      results.numPassedTests !== assignedStories.length ||
      !execution.allContextsClosed ||
      !execution.freshStorage
    ) {
      throw new Error('Missing browser context disposal evidence');
    }
    if (new Set(execution.contextIds).size !== records.length) throw new Error('Browser context reused across stories');
    if (ci && workers >= 2 && records.length >= 2 && workerIds.length < 2) {
      throw new Error('CI did not execute stories on multiple Jest workers');
    }
  }
} finally {
  try {
    stopChild();
  } finally {
    try {
      await preview?.close();
    } finally {
      process.removeListener('SIGINT', stopChild);
      process.removeListener('SIGTERM', stopChild);
    }
  }
}
