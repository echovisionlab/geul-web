// Usage: node scripts/performance/measure-build-command-context.mjs
// Records an explicit metadata allowlist; never serializes the process environment.
import { mkdirSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { availableParallelism, arch, cpus, release, totalmem } from 'node:os';
import { hostResourceScope, readCgroupSnapshot } from './measure-build-command-cgroup.mjs';
const version = (command, args) => {
  const result = spawnSync(command, args, { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`Version query failed: ${command}`);
  return result.stdout.trim();
};
const e = process.env;
const report = {
  sha: e.GITHUB_SHA,
  checkoutSha: version('git', ['rev-parse', 'HEAD']),
  runId: e.GITHUB_RUN_ID,
  runAttempt: e.GITHUB_RUN_ATTEMPT,
  requestedCacheMode: e.REQUESTED_CACHE_MODE || e.CACHE_MODE,
  cacheMode: e.CACHE_MODE,
  series: e.CACHE_SERIES,
  namespace: e.CACHE_NAMESPACE,
  compatibility: e.CACHE_COMPATIBILITY,
  caches: Object.fromEntries(
    ['FULL_TS', 'APP_TS', 'TURBO'].map((name) => [
      name,
      {
        hit: e[`${name}_HIT`] === 'true',
        hitOutput: e[`${name}_HIT`] || '',
        matchedKey: e[`${name}_KEY`] || null,
        restoreOutcome: e[`${name}_RESULT`] || 'skipped',
      },
    ]),
  ),
  versions: {
    node: process.version,
    pnpm: version('pnpm', ['--version']),
    next: version('pnpm', ['exec', 'next', '--version']),
    typescript: version('pnpm', ['exec', 'tsc', '--version']),
  },
  runner: {
    scope: hostResourceScope,
    requested: e.REQUESTED_RUNNER || e.RUNNER_LABEL,
    label: e.RUNNER_LABEL,
    name: e.RUNNER_NAME,
    environment: e.RUNNER_ENVIRONMENT,
    os: e.RUNNER_OS,
    arch: arch(),
    release: release(),
    availableCores: availableParallelism(),
    logicalCores: cpus().length,
    cpuModel: cpus()[0]?.model,
    totalMemoryBytes: totalmem(),
    constrainedMemoryBytes: process.constrainedMemory(),
    cgroup: readCgroupSnapshot(),
  },
};
mkdirSync('.artifacts/build-performance', { recursive: true });
writeFileSync('.artifacts/build-performance/context.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
