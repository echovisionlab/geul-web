import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';

// GitHub's /download URLs contain a registry-generated digest. Resolve only
// locations, keeping the committed versions, dependency graph and SHA-512 pins.
// No package-manager dependency is available yet when this script runs.
const registry = 'https://npm.pkg.github.com/';
const token = process.env.NODE_AUTH_TOKEN;
if (!token) throw new Error('Set NODE_AUTH_TOKEN with read access to the private geul packages.');

const lockfilePath = new URL('../pnpm-lock.yaml', import.meta.url);
const lockfile = await readFile(lockfilePath, 'utf8');
const entryPattern =
  /^  '(@echovisionlab\/geul-[^'@]+)@([^'()]+)':\n    resolution: \{integrity: (sha512-[A-Za-z0-9+/=]+)(?:, tarball: [^\n}]+)?\}/gm;
const entries = [...lockfile.matchAll(entryPattern)];
const manifest = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
for (const [name, version] of Object.entries(manifest.dependencies)) {
  if (name.startsWith('@echovisionlab/geul-') && !entries.some((entry) => entry[1] === name && entry[2] === version)) {
    throw new Error(`Missing supported SHA-512 lockfile entry for ${name}@${version}.`);
  }
}

async function request(url) {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    redirect: 'error',
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok)
    throw new Error(`Private package request failed (HTTP ${response.status}). Check publication and access.`);
  return response;
}

const metadata = new Map();
let resolved = lockfile;
for (const [entry, name, version, integrity] of entries) {
  if (!metadata.has(name)) {
    metadata.set(name, await (await request(new URL(name.replace('/', '%2f'), registry))).json());
  }
  const published = metadata.get(name).versions?.[version];
  if (published?.name !== name || published.version !== version || typeof published.dist?.tarball !== 'string') {
    throw new Error(`Publish ${name}@${version} to private GitHub Packages before installing.`);
  }
  const tarball = new URL(published.dist.tarball, registry);
  if (
    tarball.origin !== new URL(registry).origin ||
    !decodeURIComponent(tarball.pathname).startsWith(`/download/${name}/${version}/`) ||
    tarball.username ||
    tarball.password ||
    tarball.search ||
    tarball.hash
  ) {
    throw new Error(`Unexpected private tarball location for ${name}@${version}.`);
  }
  // Older GitHub metadata may omit dist.integrity; hash the artifact in that case.
  let publishedIntegrity = published.dist.integrity;
  if (!publishedIntegrity?.split(/\s+/).some((value) => value.startsWith('sha512-'))) {
    const bytes = await (await request(tarball)).arrayBuffer();
    publishedIntegrity = `sha512-${createHash('sha512').update(Buffer.from(bytes)).digest('base64')}`;
  }
  if (!publishedIntegrity.split(/\s+/).includes(integrity)) {
    throw new Error(
      `Integrity changed for ${name}@${version}. Migrate the original tarball or explicitly review new pins.`,
    );
  }
  const header = entry.slice(0, entry.indexOf('\n'));
  const location = tarball.href.replaceAll("'", "''");
  resolved = resolved.replace(entry, `${header}\n    resolution: {integrity: ${integrity}, tarball: '${location}'}`);
}

// Write only after every package passed verification; never persist credentials.
if (resolved !== lockfile) await writeFile(lockfilePath, resolved);
console.log(`Resolved ${entries.length} private package locations; versions and integrity pins unchanged.`);
