import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const runtimeEnv = {
  OATHKEEPER_URL: 'http://oathkeeper.test',
  ENCRYPTION_SECRET: 'vitest-encryption-secret',
  KRATOS_URL: 'http://kratos.test',
  KRATOS_ADMIN_URL: 'http://kratos-admin.test',
  SESSION_COOKIE_NAME: '__Host-test-session',
  HYDRA_ADMIN_URL: 'http://hydra-admin.test',
  SITE_ORIGIN: 'http://web.test',
  MCP_OAUTH_ISSUER_URL: 'http://sso.test',
  DRAFT_SECRET: 'vitest-draft-secret',
  HOST: 'web.test',
};

const previousEnv = new Map<string, string | undefined>();

beforeEach(() => {
  previousEnv.clear();
  for (const [key, value] of Object.entries(runtimeEnv)) {
    previousEnv.set(key, process.env[key]);
    process.env[key] = value;
  }
  vi.resetModules();
});

afterEach(() => {
  for (const [key, value] of previousEnv) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
  vi.restoreAllMocks();
});

describe('server environment contract', () => {
  it('uses SESSION_COOKIE_NAME as the only internal session cookie field', async () => {
    const { env, getSessionCookieName } = await import('./env');

    expect(env.SESSION_COOKIE_NAME).toBe('__Host-test-session');
    expect(getSessionCookieName()).toBe('__Host-test-session');
  });

  it.each(['', 'session name', 'session;name', 'session/name'])(
    'rejects an invalid session cookie name: %j',
    async (value) => {
      process.env.SESSION_COOKIE_NAME = value;
      vi.spyOn(console, 'error').mockImplementation(() => undefined);

      await expect(import('./env')).rejects.toThrow('Invalid environment variables');
    },
  );

  it('rejects a missing session cookie name', async () => {
    delete process.env.SESSION_COOKIE_NAME;
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await expect(import('./env')).rejects.toThrow('Invalid environment variables');
  });
});
