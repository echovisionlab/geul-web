/** Fixed test-only values: a developer shell must not select a running service stack. */
export const testRuntimeEnv = {
  OATHKEEPER_URL: 'http://oathkeeper.test',
  ENCRYPTION_SECRET: 'vitest-encryption-secret',
  KRATOS_URL: 'http://kratos.test',
  KRATOS_ADMIN_URL: 'http://kratos-admin.test',
  SESSION_COOKIE_NAME: 'site_session',
  HYDRA_ADMIN_URL: 'http://hydra-admin.test',
  SITE_ORIGIN: 'http://web.test',
  MCP_OAUTH_ISSUER_URL: 'http://sso.test',
  DRAFT_SECRET: 'vitest-draft-secret',
  HOST: 'http://web.test',
};
