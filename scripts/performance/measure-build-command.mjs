import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, openSync, closeSync, writeSync } from 'node:fs';
import { availableParallelism, arch, cpus, hostname, platform, release, totalmem, constants } from 'node:os';
import { resolve } from 'node:path';
import { hostResourceScope, readCgroupSnapshot } from './measure-build-command-cgroup.mjs';

// Usage: node scripts/performance/measure-build-command.mjs [--time-executable <path>] <stage> -- <command> [args...]
// Requires Linux and GNU time (default /usr/bin/time). Arguments are passed directly, without a shell.
const args = process.argv.slice(2);
let timeExecutable = '/usr/bin/time';
if (args[0] === '--time-executable') {
  timeExecutable = args[1];
  args.splice(0, 2);
}
const [stage, separator, ...command] = args;
if (stage === '--help') {
  console.log(
    'Usage: node scripts/performance/measure-build-command.mjs [--time-executable <path>] <stage> -- <command> [args...]',
  );
  console.log('Defaults to /usr/bin/time; use --time-executable for GNU time installed at another absolute path.');
  console.log('Writes report.json, time.txt, stdout.log, stderr.log and before/after host and cgroup snapshots');
  console.log('under .artifacts/build-performance/<stage>. Do not pass secrets in command arguments.');
  process.exit(0);
}
if (
  !timeExecutable?.startsWith('/') ||
  !/^[a-z0-9][a-z0-9_-]*$/.test(stage ?? '') ||
  separator !== '--' ||
  command.length === 0
) {
  console.error('Expected a safe stage name followed by -- and a command argv. Use --help for usage.');
  process.exit(2);
}
if (platform() !== 'linux') {
  console.error('Build measurement requires Linux and GNU /usr/bin/time -v.');
  process.exit(2);
}
const timeVersion = spawnSync(timeExecutable, ['--version'], { encoding: 'utf8' });
if (timeVersion.status !== 0 || !/GNU [Tt]ime/.test(timeVersion.stdout ?? '')) {
  console.error(
    `Build measurement requires GNU time at ${timeExecutable}; command was not started (${timeVersion.error?.code ?? 'not GNU time'}).`,
  );
  process.exit(2);
}
const directory = resolve('.artifacts/build-performance', stage);
mkdirSync(directory, { recursive: true });
const snapshot = (phase) => {
  const values = { scope: hostResourceScope, procFiles: {}, cgroup: readCgroupSnapshot() };
  for (const name of ['meminfo', 'vmstat']) {
    const path = `/proc/${name}`;
    let raw;
    try {
      raw = readFileSync(path, 'utf8');
    } catch (error) {
      values.procFiles[name] = { path, status: 'unavailable', error: error.code ?? 'READ_FAILED' };
      values[name] = null;
      continue;
    }
    values.procFiles[name] = { path, status: 'available' };
    writeFileSync(resolve(directory, `${phase}-${name}.txt`), raw);
    values[name] = Object.fromEntries(
      raw
        .trim()
        .split('\n')
        .map((line) => {
          const [key, value] = line.trim().split(/[:\s]+/);
          return [key, Number(value)];
        }),
    );
  }
  writeFileSync(resolve(directory, `${phase}-cgroup.json`), `${JSON.stringify(values.cgroup, null, 2)}\n`);
  return values;
};
const before = snapshot('before');
const startedAt = new Date().toISOString();
const start = performance.now();
const stdout = openSync(resolve(directory, 'stdout.log'), 'w');
const stderr = openSync(resolve(directory, 'stderr.log'), 'w');
// A process group lets cancellation reach pnpm, Next and their descendants.
const child = spawn(timeExecutable, ['-v', '-o', resolve(directory, 'time.txt'), '--', ...command], {
  detached: true,
  stdio: ['inherit', 'pipe', 'pipe'],
  env: { ...process.env, LC_ALL: 'C' },
});
child.stdout.on('data', (data) => {
  writeSync(stdout, data);
  process.stdout.write(data);
});
child.stderr.on('data', (data) => {
  writeSync(stderr, data);
  process.stderr.write(data);
});
let cancellation = null;
const shutdownGraceMs = 2000;
let ownsGroup = Boolean(child.pid);
let forcedGroupKillAttempted = false;
let cancellationTimer = null;
let cancellationComplete = null;
let resolveCancellation;
const signalGroup = (signal) => {
  if (!ownsGroup) return false;
  try {
    process.kill(-child.pid, signal);
    return true;
  } catch (error) {
    if (error.code !== 'ESRCH') throw error;
    ownsGroup = false;
    return false;
  }
};
const forward = (signal) => {
  cancellation ??= signal;
  const signalled = signalGroup(signal);
  cancellationComplete ??= new Promise((resolve) => {
    resolveCancellation = resolve;
    if (!signalled) {
      resolve();
      return;
    }
    // Keep ownership through leader exit: silent descendants can outlive GNU time's pipes.
    cancellationTimer = setTimeout(() => {
      if (signalGroup(0)) {
        forcedGroupKillAttempted = true;
        signalGroup('SIGKILL');
      }
      resolve();
    }, shutdownGraceMs);
  });
};
const onInterrupt = () => forward('SIGINT');
const onTerminate = () => forward('SIGTERM');
process.on('SIGINT', onInterrupt);
process.on('SIGTERM', onTerminate);
let spawnError = null;
child.on('error', (error) => {
  spawnError = error.message;
});
child.on('close', async (code, signal) => {
  if (cancellationComplete) {
    if (!signalGroup(0)) {
      clearTimeout(cancellationTimer);
      resolveCancellation();
    }
    await cancellationComplete;
  }
  closeSync(stdout);
  closeSync(stderr);
  const after = snapshot('after');
  let raw = '';
  try {
    raw = readFileSync(resolve(directory, 'time.txt'), 'utf8');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const number = (label) => {
    const line = raw.split('\n').find((entry) => entry.trimStart().startsWith(`${label}:`));
    return line ? Number(line.slice(line.lastIndexOf(':') + 1).trim()) : null;
  };
  const elapsed = raw.match(/Elapsed \(wall clock\) time \(h:mm:ss or m:ss\):\s*([\d:.]+)/)?.[1];
  const elapsedSeconds = elapsed ? elapsed.split(':').reduce((sum, part) => sum * 60 + Number(part), 0) : null;
  const commandSignal = Number(raw.match(/Command terminated by signal (\d+)/)?.[1]) || null;
  const terminationSignal =
    cancellation ??
    signal ??
    (commandSignal ? Object.keys(constants.signals).find((name) => constants.signals[name] === commandSignal) : null);
  const exitStatus = cancellation
    ? 128 + constants.signals[cancellation]
    : (code ?? (terminationSignal ? 128 + constants.signals[terminationSignal] : 1));
  const report = {
    schemaVersion: 1,
    stage,
    command,
    startedAt,
    finishedAt: new Date().toISOString(),
    wallSeconds: (performance.now() - start) / 1000,
    exitStatus,
    signal: terminationSignal,
    cancellation: cancellation ? { requestedSignal: cancellation, shutdownGraceMs, forcedGroupKillAttempted } : null,
    spawnError,
    timeExecutable,
    timeVersion: timeVersion.stdout.trim(),
    resourceScope: 'GNU time measures the command and its children; maxRSS is not total concurrent machine memory.',
    resources: {
      elapsedSeconds,
      userSeconds: number('User time (seconds)'),
      systemSeconds: number('System time (seconds)'),
      maxRssKiB: number('Maximum resident set size (kbytes)'),
      majorPageFaults: number('Major (requiring I/O) page faults'),
      minorPageFaults: number('Minor (reclaiming a frame) page faults'),
      swaps: number('Swaps'),
      timeExitStatus: number('Exit status'),
      complete: !terminationSignal && elapsedSeconds !== null && number('Exit status') !== null,
    },
    system: {
      scope: hostResourceScope,
      platform: platform(),
      arch: arch(),
      release: release(),
      hostname: hostname(),
      availableCores: availableParallelism(),
      logicalCores: cpus().length,
      cpuModel: cpus()[0]?.model,
      totalMemoryBytes: totalmem(),
      constrainedMemoryBytes: process.constrainedMemory(),
      node: process.version,
      before,
      after,
      swapCounterDelta: Object.fromEntries(
        ['pswpin', 'pswpout'].map((key) => [
          key,
          Number.isFinite(after.vmstat?.[key]) && Number.isFinite(before.vmstat?.[key])
            ? after.vmstat[key] - before.vmstat[key]
            : null,
        ]),
      ),
    },
  };
  writeFileSync(resolve(directory, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  process.removeListener('SIGINT', onInterrupt);
  process.removeListener('SIGTERM', onTerminate);
  if (terminationSignal) process.kill(process.pid, terminationSignal);
  else process.exitCode = exitStatus;
});
