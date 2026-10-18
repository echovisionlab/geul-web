import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { setImmediate } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { readCgroupSnapshot } from './measure-build-command-cgroup.mjs';

const helper = fileURLToPath(new URL('./measure-build-command.mjs', import.meta.url));
const linux = process.platform === 'linux';
const linuxOnly = linux ? false : 'Requires Linux; GNU time integration runs in the quality CI job.';

test('rejects a stage that could write outside the artifact directory', () => {
  const result = spawnSync(process.execPath, [helper, '../escape', '--', process.execPath, '-e', 'process.exit(0)']);
  assert.equal(result.status, 2);
  assert.match(result.stderr.toString(), /safe stage name/);
});

test(
  'rejects unsupported platforms before running the command',
  { skip: linux ? 'Non-Linux contract.' : false },
  (t) => {
    const cwd = mkdtempSync(join(tmpdir(), 'measure-build-command-'));
    t.after(() => rmSync(cwd, { recursive: true, force: true }));
    const result = spawnSync(
      process.execPath,
      [helper, 'unsupported', '--', process.execPath, '-e', "console.log('started')"],
      {
        cwd,
        encoding: 'utf8',
      },
    );
    assert.equal(result.status, 2);
    assert.match(result.stderr, /requires Linux/);
    assert.equal(result.stdout, '');
    assert.equal(existsSync(join(cwd, '.artifacts')), false);
  },
);

for (const kind of ['missing', 'non-GNU']) {
  test(`rejects ${kind} time before command execution`, { skip: linuxOnly }, (t) => {
    const cwd = mkdtempSync(join(tmpdir(), 'measure-build-command-'));
    t.after(() => rmSync(cwd, { recursive: true, force: true }));
    const executable = kind === 'missing' ? join(cwd, 'missing-time') : process.execPath;
    const result = spawnSync(
      process.execPath,
      [
        helper,
        '--time-executable',
        executable,
        'unmeasured',
        '--',
        process.execPath,
        '-e',
        "require('node:fs').writeFileSync('started', 'yes')",
      ],
      { cwd, encoding: 'utf8' },
    );
    assert.equal(result.status, 2);
    assert.match(result.stderr, /requires GNU time.*command was not started/);
    assert.ok(result.stderr.includes(executable));
    assert.equal(existsSync(join(cwd, 'started')), false);
    assert.equal(existsSync(join(cwd, '.artifacts')), false);
  });
}

for (const exitStatus of [0, 23]) {
  test(
    `preserves argv, both output streams and command exit ${exitStatus} with resource evidence`,
    { skip: linuxOnly },
    (t) => {
      const cwd = mkdtempSync(join(tmpdir(), 'measure-build-command-'));
      t.after(() => rmSync(cwd, { recursive: true, force: true }));
      const literal = 'literal $(exit 99); with spaces';
      const command = [
        process.execPath,
        '-e',
        `process.stdout.write(process.argv[1]); process.stderr.write('diagnostic'); process.exit(${exitStatus})`,
        literal,
      ];
      const result = spawnSync(process.execPath, [helper, 'smoke', '--', ...command], { cwd, encoding: 'utf8' });
      assert.equal(result.status, exitStatus);
      assert.equal(result.stdout, literal);
      assert.equal(result.stderr, 'diagnostic');
      const artifact = join(cwd, '.artifacts/build-performance/smoke');
      const report = JSON.parse(readFileSync(join(artifact, 'report.json'), 'utf8'));
      assert.deepEqual(report.command, command);
      assert.equal(report.exitStatus, exitStatus);
      assert.equal(report.cancellation, null);
      assert.equal(report.resources.timeExitStatus, exitStatus);
      assert.equal(report.resources.complete, true);
      assert.ok(report.resources.maxRssKiB > 0);
      for (const field of [
        'elapsedSeconds',
        'userSeconds',
        'systemSeconds',
        'majorPageFaults',
        'minorPageFaults',
        'swaps',
      ]) {
        assert.equal(typeof report.resources[field], 'number');
        assert.ok(report.resources[field] >= 0);
      }
      assert.equal(typeof report.system.swapCounterDelta.pswpin, 'number');
      assert.equal(typeof report.system.swapCounterDelta.pswpout, 'number');
      assert.match(report.resourceScope, /not total concurrent machine memory/);
      assert.match(report.system.scope, /host-scoped.*not container limits/);
      assert.equal(readFileSync(join(artifact, 'stdout.log'), 'utf8'), literal);
      assert.equal(readFileSync(join(artifact, 'stderr.log'), 'utf8'), 'diagnostic');
      for (const phase of ['before', 'after']) {
        assert.match(readFileSync(join(artifact, `${phase}-meminfo.txt`), 'utf8'), /MemTotal:/);
        assert.match(readFileSync(join(artifact, `${phase}-vmstat.txt`), 'utf8'), /pswpin/);
        const cgroup = JSON.parse(readFileSync(join(artifact, `${phase}-cgroup.json`), 'utf8'));
        assert.deepEqual(cgroup, report.system[phase].cgroup);
        assert.equal(cgroup.membership.path, '/proc/self/cgroup');
        assert.equal(cgroup.mountinfo.path, '/proc/self/mountinfo');
        assert.ok(['available', 'unavailable', 'unsupported'].includes(cgroup.status));
        if (cgroup.files) {
          for (const name of [
            'memory.max',
            'memory.current',
            'memory.peak',
            'memory.events',
            'memory.swap.current',
            'memory.swap.max',
            'cpu.max',
            'cpu.stat',
          ]) {
            assert.equal(cgroup.files[name].path, `${cgroup.directory}/${name}`);
            if (cgroup.files[name].status === 'available') assert.equal(typeof cgroup.files[name].raw, 'string');
            else assert.equal(typeof cgroup.files[name].error, 'string');
          }
        }
      }
    },
  );
}

const processEvidence = (pid) => {
  try {
    const raw = readFileSync(`/proc/${pid}/stat`, 'utf8');
    const fields = raw.slice(raw.lastIndexOf(')') + 2).split(' ');
    return { pid, state: fields[0], group: Number(fields[2]), session: Number(fields[3]), started: fields[19] };
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    return null;
  }
};

async function cancellationFixture(t, { stage, silent = false, cooperative = false }) {
  const cwd = mkdtempSync(join(tmpdir(), 'measure-build-command-'));
  const evidencePath = join(cwd, 'pids.json');
  const source = `
    const { spawn } = require('node:child_process');
    const { readFileSync, writeFileSync } = require('node:fs');
    const evidence = ${processEvidence.toString()};
    const owner = evidence(process.pid);
    if (owner.group !== process.ppid || owner.session !== owner.group) throw new Error('Expected detached GNU time group');
    const pids = { owner, members: [owner] };
    const save = () => writeFileSync('pids.json', JSON.stringify(pids));
    save();
    if (${cooperative}) {
      console.log('ready');
      process.stdin.resume();
    } else {
      for (const signal of ['SIGTERM', 'SIGINT']) {
        process.on(signal, () => { if (${silent}) process.exit(0); });
      }
      const descendant = spawn(process.execPath, ['-e', ${JSON.stringify(`
        const { writeFileSync } = require('node:fs');
        for (const signal of ['SIGTERM', 'SIGINT']) {
          process.on(signal, () => writeFileSync('descendant-signal', signal));
        }
        setInterval(() => {}, 1000);
        process.send('ready');
        process.disconnect();
      `)}], { stdio: ['ignore', ${silent ? "'ignore', 'ignore'" : "'inherit', 'inherit'"}, 'ipc'] });
      pids.members.push(evidence(descendant.pid));
      save();
      descendant.once('message', () => console.log('ready'));
    }
  `;
  const child = spawn(process.execPath, [helper, stage, '--', process.execPath, '-e', source], {
    cwd,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  const closed = once(child, 'close');
  let didClose = false;
  child.once('close', () => (didClose = true));
  let stderr = '';
  child.stderr.on('data', (data) => (stderr += data));
  const lines = createInterface({ input: child.stdout });
  t.after(async () => {
    lines.close();
    try {
      if (!didClose) {
        child.kill('SIGTERM');
        try {
          await once(child, 'close', { signal: AbortSignal.timeout(5000) });
        } catch (error) {
          if (error.name !== 'AbortError') throw error;
        }
      }
    } finally {
      // Only a recorded member with the same start time can authorize this fixture's group cleanup.
      if (existsSync(evidencePath)) {
        const { owner, members } = JSON.parse(readFileSync(evidencePath, 'utf8'));
        if (
          owner.group > 1 &&
          owner.group === owner.session &&
          members.some((member) => {
            const current = processEvidence(member.pid);
            return (
              current?.started === member.started && current.group === owner.group && current.session === owner.session
            );
          })
        ) {
          try {
            process.kill(-owner.group, 'SIGKILL');
          } catch (error) {
            if (error.code !== 'ESRCH') throw error;
          }
        }
      }
      if (!didClose) child.kill('SIGKILL');
      rmSync(cwd, { recursive: true, force: true });
    }
  });
  const [line] = await Promise.race([
    once(lines, 'line', { signal: t.signal }),
    closed.then(() => {
      throw new Error(`Command closed before readiness: ${stderr}`);
    }),
  ]);
  assert.equal(line, 'ready');
  const pids = JSON.parse(readFileSync(evidencePath, 'utf8'));
  assert.ok(pids.members.every((member) => member.group === pids.owner.group && member.session === pids.owner.session));
  return { cwd, child, closed, pids, artifact: join(cwd, '.artifacts/build-performance', stage) };
}

async function assertMembersStopped(t, { pids }) {
  for (const member of pids.members) {
    // Orphan zombies await the host reaper; they cannot run or retain output pipes.
    while (true) {
      const current = processEvidence(member.pid);
      if (!current || current.started !== member.started || ['Z', 'X'].includes(current.state)) break;
      await setImmediate(undefined, { signal: t.signal });
    }
  }
}

test(
  'forwards cooperative cancellation and leaves a cancelled report without forced termination',
  { skip: linuxOnly, timeout: 10000 },
  async (t) => {
    const fixture = await cancellationFixture(t, { stage: 'cancel', cooperative: true });
    fixture.child.kill('SIGINT');
    assert.deepEqual(await fixture.closed, [null, 'SIGINT']);
    const report = JSON.parse(readFileSync(join(fixture.artifact, 'report.json'), 'utf8'));
    assert.equal(report.signal, 'SIGINT');
    assert.equal(report.exitStatus, 130);
    assert.deepEqual(report.cancellation, {
      requestedSignal: 'SIGINT',
      shutdownGraceMs: 2000,
      forcedGroupKillAttempted: false,
    });
    await assertMembersStopped(t, fixture);
  },
);

for (const { name, silent, signal, exitStatus } of [
  { name: 'a resistant descendant holding output pipes', silent: false, signal: 'SIGTERM', exitStatus: 143 },
  {
    name: 'a silent resistant descendant after its parent exits zero',
    silent: true,
    signal: 'SIGINT',
    exitStatus: 130,
  },
]) {
  test(`bounds cancellation of ${name}`, { skip: linuxOnly, timeout: 10000 }, async (t) => {
    const fixture = await cancellationFixture(t, { stage: 'resistant', silent });
    const cancelledAt = performance.now();
    fixture.child.kill(signal);
    assert.deepEqual(await fixture.closed, [null, signal]);
    const elapsed = performance.now() - cancelledAt;
    assert.ok(
      elapsed >= 1900 && elapsed < 5000,
      `Expected the two-second shutdown grace and bounded exit: ${elapsed}ms`,
    );
    const report = JSON.parse(readFileSync(join(fixture.artifact, 'report.json'), 'utf8'));
    assert.equal(report.signal, signal);
    assert.equal(report.exitStatus, exitStatus);
    assert.deepEqual(report.cancellation, {
      requestedSignal: signal,
      shutdownGraceMs: 2000,
      forcedGroupKillAttempted: true,
    });
    assert.equal(report.resources.complete, false);
    assert.equal(readFileSync(join(fixture.cwd, 'descendant-signal'), 'utf8'), signal);
    assert.equal(readFileSync(join(fixture.artifact, 'stdout.log'), 'utf8'), 'ready\n');
    assert.equal(readFileSync(join(fixture.artifact, 'stderr.log'), 'utf8'), '');
    if (silent) {
      assert.equal(report.resources.timeExitStatus, 0, 'GNU time closed successfully before descendant cleanup');
    }
    await assertMembersStopped(t, fixture);
  });
}

const cgroupFixture =
  (membership, mountinfo, files = {}) =>
  (path) => {
    const raw = { '/proc/self/cgroup': membership, '/proc/self/mountinfo': mountinfo, ...files }[path];
    if (raw === undefined || raw instanceof Error) throw raw ?? Object.assign(new Error('missing'), { code: 'ENOENT' });
    return raw;
  };

for (const { name, membership, mounts, directory } of [
  {
    name: 'host hierarchy',
    membership: '0::/jobs/build\n',
    mounts: '1 0 0:1 / /sys/fs/cgroup rw - cgroup2 cgroup rw',
    directory: '/sys/fs/cgroup/jobs/build',
  },
  {
    name: 'bind mount with a non-root hierarchy root',
    membership: '0::/pods/runner/job\n',
    mounts: '1 0 0:1 /pods/runner /cgroup rw - cgroup2 cgroup rw',
    directory: '/cgroup/job',
  },
  {
    name: 'namespace root',
    membership: '0::/\n',
    mounts: '1 0 0:1 / /sys/fs/cgroup rw - cgroup2 cgroup rw',
    directory: '/sys/fs/cgroup',
  },
  {
    name: 'most specific mount and escaped mountpoint',
    membership: '0::/pods/job\n',
    mounts: '1 0 0:1 / /sys/fs/cgroup rw - cgroup2 cgroup rw\n2 0 0:1 /pods /cgroup\\040mount rw - cgroup2 cgroup rw',
    directory: '/cgroup mount/job',
  },
]) {
  test(`captures cgroup paths and raw values for ${name}`, () => {
    const rawFiles = {
      'memory.max': '8589934592\n',
      'memory.current': '12345\n',
      'memory.peak': '67890\n',
      'memory.events': 'oom 0\noom_kill 0\n',
      'memory.swap.current': '0\n',
      'memory.swap.max': 'max\n',
      'cpu.max': '200000 100000\n',
      'cpu.stat': 'usage_usec 123\nnr_throttled 2\n',
    };
    const snapshot = readCgroupSnapshot(
      cgroupFixture(
        membership,
        mounts,
        Object.fromEntries(Object.entries(rawFiles).map(([file, raw]) => [`${directory}/${file}`, raw])),
      ),
    );
    assert.equal(snapshot.status, 'available');
    assert.equal(snapshot.version, 2);
    assert.equal(snapshot.directory, directory);
    for (const [name, raw] of Object.entries(rawFiles)) {
      assert.deepEqual(snapshot.files[name], { path: `${directory}/${name}`, status: 'available', raw });
    }
    assert.equal(snapshot.membership.raw, membership);
    assert.equal(snapshot.mountinfo.raw, mounts);
    assert.match(snapshot.scope, /Ancestors may impose stricter limits/);
  });
}

test('reports unavailable cgroup files without replacing them with host values', () => {
  const snapshot = readCgroupSnapshot(
    cgroupFixture('0::/\n', '1 0 0:1 / /cgroup rw - cgroup2 cgroup rw', {
      '/cgroup/memory.current': '42\n',
      '/cgroup/memory.max': Object.assign(new Error('denied'), { code: 'EACCES' }),
    }),
  );
  assert.equal(snapshot.status, 'unavailable');
  assert.deepEqual(snapshot.files['memory.current'], {
    path: '/cgroup/memory.current',
    status: 'available',
    raw: '42\n',
  });
  assert.deepEqual(snapshot.files['memory.max'], {
    path: '/cgroup/memory.max',
    status: 'unavailable',
    error: 'EACCES',
  });
  assert.deepEqual(snapshot.files['memory.peak'], {
    path: '/cgroup/memory.peak',
    status: 'unavailable',
    error: 'ENOENT',
  });
});

for (const membership of ['0::/pods-other/job\n', '0::/../job\n']) {
  test(`does not guess a cgroup directory for ${membership.trim()}`, () => {
    const snapshot = readCgroupSnapshot(cgroupFixture(membership, '1 0 0:1 /pods /cgroup rw - cgroup2 cgroup rw'));
    assert.equal(snapshot.status, 'unavailable');
    assert.equal(snapshot.directory, undefined);
    assert.match(snapshot.reason, /No matching/);
  });
}

test('reports unsupported v1 and unreadable proc evidence without throwing', () => {
  const legacy = readCgroupSnapshot(cgroupFixture('5:memory:/job\n4:cpu,cpuacct:/job\n', ''));
  assert.equal(legacy.status, 'unsupported');
  assert.equal(legacy.version, 1);
  assert.match(legacy.v1, /unsupported v1/);
  const missing = readCgroupSnapshot(cgroupFixture(undefined, undefined));
  assert.equal(missing.status, 'unavailable');
  assert.equal(missing.membership.error, 'ENOENT');
  assert.equal(missing.mountinfo.error, 'ENOENT');
});

test('excludes unrelated mount options from cgroup evidence', () => {
  const snapshot = readCgroupSnapshot(
    cgroupFixture(
      '0::/\n',
      '1 0 0:1 / /cgroup rw - cgroup2 cgroup rw\n2 0 0:2 / /unrelated rw - examplefs device sensitive=omitted\n',
    ),
  );
  assert.equal(snapshot.mountinfo.raw, '1 0 0:1 / /cgroup rw - cgroup2 cgroup rw');
  assert.equal(snapshot.mountinfo.selection, 'cgroup and cgroup2 entries only');
});
