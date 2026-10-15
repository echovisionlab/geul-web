import 'server-only';
import * as z from 'zod/mini';
import en from 'zod/v4/locales/en.js';
import { readPublicRuntimeEnvironment, type PublicRuntimeConfig } from './public-runtime-config';

// Match Classic Zod's default locale so validation messages remain unchanged.
z.config(en());

const url = z.url();
const publicRuntimeConfigSchema = z.object({
  cdnUrl: url,
  apiUrl: url,
  p5RunnerUrl: z.optional(url),
  googleMapsApiKey: z.optional(z.string()),
  editorImageMaxSizeBytes: z.number().check(z.int(), z.gt(0)),
  authCodeLifespanSeconds: z.number().check(z.int(), z.gt(0)),
  authCodeResendCooldownSeconds: z.number().check(z.int(), z.gt(0)),
});

/**
 * The only validation boundary for public runtime settings. The root layout projects the
 * result into `<html data-geul-*>`; server route handlers call this directly. Invalid URLs
 * throw, so a misconfigured deployment fails on the server instead of in every browser.
 */
export function getServerPublicRuntimeConfig(): PublicRuntimeConfig {
  const config = publicRuntimeConfigSchema.parse(readPublicRuntimeEnvironment());
  return { ...config, p5RunnerUrl: config.p5RunnerUrl, googleMapsApiKey: config.googleMapsApiKey };
}
