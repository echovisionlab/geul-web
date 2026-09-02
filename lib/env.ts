import { createEnv } from '@t3-oss/env-nextjs';
import { z } from 'zod';

// URL schema that strips trailing slashes
const urlWithoutTrailingSlash = () => z.url().transform((url) => url.replace(/\/+$/, ''));
const originWithoutTrailingSlash = () =>
  z.url().transform((value, context) => {
    const url = new URL(value);
    if (
      (url.protocol !== 'http:' && url.protocol !== 'https:') ||
      url.username ||
      url.password ||
      (url.pathname !== '' && url.pathname !== '/') ||
      url.search ||
      url.hash
    ) {
      context.addIssue({
        code: 'custom',
        message: 'must be an HTTP(S) origin without credentials, path, query, or fragment',
      });
      return z.NEVER;
    }
    return url.origin;
  });
const cookieName = () =>
  z
    .string()
    .min(1)
    .regex(/^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/);

// Helper to get API URL (via Oathkeeper)
export function getApiUrl(): string {
  return env.OATHKEEPER_URL;
}

// Helper to get Kratos URLs
export function getKratosUrl(): string {
  return env.KRATOS_URL;
}

export function getKratosAdminUrl(): string {
  return env.KRATOS_ADMIN_URL;
}

export function getSessionCookieName(): string {
  return env.SESSION_COOKIE_NAME;
}

export function getHydraAdminUrl(): string {
  return env.HYDRA_ADMIN_URL;
}

export function getSiteOrigin(): string {
  return env.SITE_ORIGIN;
}

export function getMcpOAuthIssuerUrl(): string {
  return env.MCP_OAUTH_ISSUER_URL;
}

export const env = createEnv({
  server: {
    // Oathkeeper (API Gateway)
    OATHKEEPER_URL: urlWithoutTrailingSlash(),

    // Encryption (for unsubscribe tokens etc.)
    ENCRYPTION_SECRET: z.string().min(16),

    // Kratos (server-side)
    KRATOS_URL: urlWithoutTrailingSlash(),
    KRATOS_ADMIN_URL: urlWithoutTrailingSlash(),
    SESSION_COOKIE_NAME: cookieName(),

    // Hydra Admin (cluster-private, server-side only)
    HYDRA_ADMIN_URL: urlWithoutTrailingSlash(),

    // Public origins used to derive the MCP OAuth issuer and resource.
    SITE_ORIGIN: originWithoutTrailingSlash(),
    MCP_OAUTH_ISSUER_URL: originWithoutTrailingSlash(),

    // Draft Preview
    DRAFT_SECRET: z.string().min(16),

    // Host configuration
    HOST: z.string(),

    NODE_ENV: z.enum(['development', 'test', 'production']).optional(),
  },
  runtimeEnv: {
    // Oathkeeper (API Gateway)
    OATHKEEPER_URL: process.env.OATHKEEPER_URL,

    // Encryption
    ENCRYPTION_SECRET: process.env.ENCRYPTION_SECRET,

    // Kratos (server-side)
    KRATOS_URL: process.env.KRATOS_URL,
    KRATOS_ADMIN_URL: process.env.KRATOS_ADMIN_URL,
    SESSION_COOKIE_NAME: process.env.SESSION_COOKIE_NAME,
    HYDRA_ADMIN_URL: process.env.HYDRA_ADMIN_URL,
    SITE_ORIGIN: process.env.SITE_ORIGIN,
    MCP_OAUTH_ISSUER_URL: process.env.MCP_OAUTH_ISSUER_URL,

    // Draft Preview
    DRAFT_SECRET: process.env.DRAFT_SECRET,

    // Host configuration
    HOST: process.env.HOST,

    NODE_ENV: process.env.NODE_ENV as 'development' | 'test' | 'production' | undefined,
  },
});
