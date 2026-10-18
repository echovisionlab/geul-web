import { readFileSync } from 'node:fs';
import { posix } from 'node:path';

export const hostResourceScope =
  '/proc/meminfo, /proc/vmstat and os.totalmem are host-scoped observations, not container limits. ' +
  'CPU counts and availableParallelism are runtime observations, not cgroup CPU quotas.';

// The reader is the filesystem boundary; fixtures can represent other mount namespaces.
export function readCgroupSnapshot(readFile = readFileSync) {
  const read = (path) => {
    try {
      return { path, status: 'available', raw: readFile(path, 'utf8') };
    } catch (error) {
      return { path, status: 'unavailable', error: error.code ?? 'READ_FAILED' };
    }
  };
  const membership = read('/proc/self/cgroup');
  const mountinfo = read('/proc/self/mountinfo');
  if (mountinfo.status === 'available') {
    // Unrelated mounts can contain sensitive options and are not measurement evidence.
    mountinfo.selection = 'cgroup and cgroup2 entries only';
    mountinfo.raw = mountinfo.raw
      .split('\n')
      .filter((line) => / - cgroup2? /.test(line))
      .join('\n');
  }
  const evidence = {
    scope:
      'Current process cgroup, shared with other members and descendants. Ancestors may impose stricter limits; ' +
      'memory.peak is cumulative for this cgroup and is not reset by measurement.',
    membership,
    mountinfo,
  };
  if (membership.status !== 'available' || mountinfo.status !== 'available') {
    return { ...evidence, status: 'unavailable', reason: 'Cannot read current cgroup membership or mount table.' };
  }
  const cgroupPath = membership.raw.match(/^0::(\/.*)$/m)?.[1];
  const legacy = membership.raw.split('\n').some((line) => /^\d+:[^:]+:/.test(line));
  const v1 = legacy ? 'unsupported v1 controllers; only cgroup v2 is collected' : null;
  if (!cgroupPath) {
    return {
      ...evidence,
      status: legacy ? 'unsupported' : 'unavailable',
      version: legacy ? 1 : null,
      v1,
      reason: legacy ? 'cgroup v1 collection is unsupported.' : 'No current cgroup v2 membership entry.',
    };
  }
  const decode = (value) => value.replace(/\\([0-7]{3})/g, (_, octal) => String.fromCharCode(parseInt(octal, 8)));
  const mounts = mountinfo.raw.split('\n').flatMap((line) => {
    const [left, right] = line.split(' - ');
    if (right?.split(' ')[0] !== 'cgroup2') return [];
    const fields = left.split(' ');
    return fields.length >= 6 ? [{ root: decode(fields[3]), mountPoint: decode(fields[4]) }] : [];
  });
  // Do not normalize traversal or infer an inaccessible namespace's cgroup root.
  const safeAbsolute = (path) => path.startsWith('/') && !path.split('/').some((part) => part === '.' || part === '..');
  const mount = mounts
    .filter(
      ({ root, mountPoint }) =>
        [cgroupPath, root, mountPoint].every(safeAbsolute) &&
        (root === '/' || cgroupPath === root || cgroupPath.startsWith(`${root}/`)),
    )
    .sort((a, b) => b.root.length - a.root.length)[0];
  if (!mount) {
    return { ...evidence, status: 'unavailable', version: 2, cgroupPath, v1, reason: 'No matching cgroup v2 mount.' };
  }
  const directory = posix.join(mount.mountPoint, posix.relative(mount.root, cgroupPath));
  const files = Object.fromEntries(
    [
      'memory.max',
      'memory.current',
      'memory.peak',
      'memory.events',
      'memory.swap.current',
      'memory.swap.max',
      'cpu.max',
      'cpu.stat',
    ].map((name) => [name, read(posix.join(directory, name))]),
  );
  return {
    ...evidence,
    status: Object.values(files).every((file) => file.status === 'available') ? 'available' : 'unavailable',
    version: 2,
    cgroupPath,
    ...mount,
    directory,
    v1,
    files,
  };
}
