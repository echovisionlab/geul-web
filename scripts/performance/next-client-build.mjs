import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

// Run only in an isolated checkout/snapshot without dotenv files. Next loads
// dotenv itself, so avoiding the project's dotenv-cli alone is insufficient.
const root = resolve(process.argv[2] || '.');
const mode = process.argv[3] || 'build';
if (!['build', 'analyze'].includes(mode)) throw new Error('Expected build or analyze');
if (readdirSync(root).some((name) => name === '.env' || (name.startsWith('.env.') && name !== '.env.example'))) {
  throw new Error('Use a secret-free isolated snapshot without dotenv files');
}
const result = spawnSync(
  process.execPath,
  [
    resolve(root, 'node_modules/next/dist/bin/next'),
    ...(mode === 'build' ? ['build'] : ['experimental-analyze', '--output']),
  ],
  {
    cwd: root,
    stdio: 'inherit',
    // Deliberately do not forward application secrets/config from the caller.
    env: {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      TMPDIR: process.env.TMPDIR,
      NEXT_TELEMETRY_DISABLED: '1',
      OATHKEEPER_URL: 'http://localhost:8000',
      KRATOS_URL: 'http://localhost:4433',
      KRATOS_ADMIN_URL: 'http://localhost:4434',
      HYDRA_ADMIN_URL: 'http://localhost:4445',
      MCP_OAUTH_ISSUER_URL: 'http://sso.localhost:4444',
      SITE_ORIGIN: 'http://localhost:3000',
      SESSION_COOKIE_NAME: 'site_session',
      DRAFT_SECRET: 'build-time-placeholder-secret123',
      ENCRYPTION_SECRET: 'build-time-placeholder-secret123',
      HOST: 'localhost',
    },
  },
);
if (result.error) throw result.error;
process.exit(result.status ?? 1);
