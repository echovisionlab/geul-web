import { z } from 'zod';

const urlWithoutTrailingSlash = z.url().transform((url) => url.replace(/\/+$/, ''));
const optionalUrlWithoutTrailingSlash = z
  .url()
  .optional()
  .transform((url) => url?.replace(/\/+$/, ''));
const optionalString = z
  .string()
  .optional()
  .transform((value) => {
    const trimmed = value?.trim();
    return trimmed ? trimmed : undefined;
  });
const positiveInteger = z.coerce.number().int().positive();
const optionalPositiveInteger = z
  .union([z.string(), z.number()])
  .optional()
  .transform((value) => {
    if (value == null) {
      return undefined;
    }
    const parsed = positiveInteger.safeParse(value);
    return parsed.success ? parsed.data : undefined;
  });

const DEFAULT_EDITOR_IMAGE_MAX_SIZE_BYTES = 30 * 1024 * 1024;
const DEFAULT_AUTH_CODE_LIFESPAN_SECONDS = 15 * 60;
const DEFAULT_AUTH_CODE_RESEND_COOLDOWN_SECONDS = 60;

const publicRuntimeConfigSchema = z.object({
  cdnUrl: urlWithoutTrailingSlash,
  apiUrl: urlWithoutTrailingSlash,
  p5RunnerUrl: optionalUrlWithoutTrailingSlash,
  googleMapsApiKey: optionalString,
  editorImageMaxSizeBytes: positiveInteger,
  authCodeLifespanSeconds: positiveInteger,
  authCodeResendCooldownSeconds: positiveInteger,
});

export type PublicRuntimeConfig = z.infer<typeof publicRuntimeConfigSchema>;

declare global {
  interface Window {
    __GEUL_RUNTIME_CONFIG__?: PublicRuntimeConfig;
  }
}

const defaultPublicRuntimeConfig: PublicRuntimeConfig = {
  cdnUrl: 'http://localhost:8081',
  apiUrl: 'http://localhost:8000',
  p5RunnerUrl: undefined,
  googleMapsApiKey: undefined,
  editorImageMaxSizeBytes: DEFAULT_EDITOR_IMAGE_MAX_SIZE_BYTES,
  authCodeLifespanSeconds: DEFAULT_AUTH_CODE_LIFESPAN_SECONDS,
  authCodeResendCooldownSeconds: DEFAULT_AUTH_CODE_RESEND_COOLDOWN_SECONDS,
};

function envValue(...candidates: Array<string | undefined>): string | undefined {
  for (const candidate of candidates) {
    const trimmed = candidate?.trim();
    if (trimmed) {
      return trimmed;
    }
  }
  return undefined;
}

function parseRuntimeConfig(raw: {
  cdnUrl?: string;
  apiUrl?: string;
  p5RunnerUrl?: string;
  googleMapsApiKey?: string;
  editorImageMaxSizeBytes?: string | number;
  authCodeLifespanSeconds?: string | number;
  authCodeResendCooldownSeconds?: string | number;
}): PublicRuntimeConfig {
  return publicRuntimeConfigSchema.parse({
    cdnUrl: raw.cdnUrl ?? defaultPublicRuntimeConfig.cdnUrl,
    apiUrl: raw.apiUrl ?? defaultPublicRuntimeConfig.apiUrl,
    p5RunnerUrl: raw.p5RunnerUrl,
    googleMapsApiKey: raw.googleMapsApiKey,
    editorImageMaxSizeBytes:
      optionalPositiveInteger.parse(raw.editorImageMaxSizeBytes) ?? defaultPublicRuntimeConfig.editorImageMaxSizeBytes,
    authCodeLifespanSeconds:
      optionalPositiveInteger.parse(raw.authCodeLifespanSeconds) ?? defaultPublicRuntimeConfig.authCodeLifespanSeconds,
    authCodeResendCooldownSeconds:
      optionalPositiveInteger.parse(raw.authCodeResendCooldownSeconds) ??
      defaultPublicRuntimeConfig.authCodeResendCooldownSeconds,
  });
}

export function getServerPublicRuntimeConfig(): PublicRuntimeConfig {
  return parseRuntimeConfig({
    cdnUrl: envValue(process.env.PUBLIC_CDN_URL),
    apiUrl: envValue(process.env.PUBLIC_API_URL),
    p5RunnerUrl: envValue(process.env.PUBLIC_P5_RUNNER_URL),
    googleMapsApiKey: envValue(process.env.PUBLIC_GOOGLE_MAPS_API_KEY),
    editorImageMaxSizeBytes: envValue(process.env.PUBLIC_EDITOR_IMAGE_MAX_SIZE_BYTES),
    authCodeLifespanSeconds: envValue(process.env.AUTH_CODE_LIFESPAN_SECONDS),
    authCodeResendCooldownSeconds: envValue(process.env.AUTH_CODE_RESEND_COOLDOWN_SECONDS),
  });
}

let cachedClientRuntimeConfig: PublicRuntimeConfig | null = null;

function readRuntimeConfigFromDataset(): PublicRuntimeConfig | null {
  if (typeof document === 'undefined') {
    return null;
  }

  const root = document.documentElement;
  const cdnUrl = root.dataset.geulCdnUrl;
  const apiUrl = root.dataset.geulApiUrl;

  if (!cdnUrl || !apiUrl) {
    return null;
  }

  return parseRuntimeConfig({
    cdnUrl,
    apiUrl,
    p5RunnerUrl: root.dataset.geulP5RunnerUrl,
    googleMapsApiKey: root.dataset.geulGoogleMapsApiKey,
    editorImageMaxSizeBytes: root.dataset.geulEditorImageMaxSizeBytes,
    authCodeLifespanSeconds: root.dataset.geulAuthCodeLifespanSeconds,
    authCodeResendCooldownSeconds: root.dataset.geulAuthCodeResendCooldownSeconds,
  });
}

function getPublicRuntimeConfig(): PublicRuntimeConfig {
  if (typeof window === 'undefined') {
    return getServerPublicRuntimeConfig();
  }

  if (cachedClientRuntimeConfig) {
    return cachedClientRuntimeConfig;
  }

  const datasetRuntimeConfig = readRuntimeConfigFromDataset();
  if (datasetRuntimeConfig) {
    cachedClientRuntimeConfig = datasetRuntimeConfig;
    return cachedClientRuntimeConfig;
  }

  const injectedRuntimeConfig = window.__GEUL_RUNTIME_CONFIG__;
  if (!injectedRuntimeConfig) {
    cachedClientRuntimeConfig = parseRuntimeConfig(defaultPublicRuntimeConfig);
    return cachedClientRuntimeConfig;
  }

  cachedClientRuntimeConfig = parseRuntimeConfig(injectedRuntimeConfig);
  return cachedClientRuntimeConfig;
}

export function getPublicAuthUrl(): string {
  return '/api/auth';
}

export function getPublicCollabUrl(): string {
  return '/collab';
}

export function getPublicCdnUrl(): string {
  return getPublicRuntimeConfig().cdnUrl;
}

export function getPublicApiUrl(): string {
  return getPublicRuntimeConfig().apiUrl;
}

export function getPublicP5RunnerUrl(): string | undefined {
  if (typeof document !== 'undefined') {
    const datasetValue = document.documentElement.dataset.geulP5RunnerUrl?.trim();
    if (datasetValue) {
      return datasetValue;
    }
  }
  return getPublicRuntimeConfig().p5RunnerUrl;
}

export function getPublicGoogleMapsApiKey(): string | undefined {
  return getPublicRuntimeConfig().googleMapsApiKey;
}

export function getPublicEditorImageMaxSizeBytes(): number {
  return getPublicRuntimeConfig().editorImageMaxSizeBytes;
}

export function getPublicAuthCodeLifespanSeconds(): number {
  return getPublicRuntimeConfig().authCodeLifespanSeconds;
}

export function getPublicAuthCodeResendCooldownSeconds(): number {
  return getPublicRuntimeConfig().authCodeResendCooldownSeconds;
}
