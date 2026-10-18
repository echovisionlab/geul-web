/**
 * Public runtime settings shared by server and browser code. Validation lives in
 * `public-runtime-config.server.ts`; this module only decodes values that the server already
 * validated and projected into `<html data-geul-*>`, so it ships no schema library to clients.
 */
export interface PublicRuntimeConfig {
  cdnUrl: string;
  fontBaseUrl: string;
  apiUrl: string;
  p5RunnerUrl: string | undefined;
  googleMapsApiKey: string | undefined;
  editorImageMaxSizeBytes: number;
  authCodeLifespanSeconds: number;
  authCodeResendCooldownSeconds: number;
}

/** Development and test fallbacks. Production browsers must receive the server projection. */
const developmentPublicRuntimeConfig: PublicRuntimeConfig = {
  cdnUrl: 'http://localhost:8081',
  fontBaseUrl: 'https://static.rawsector.com/fonts',
  apiUrl: 'http://localhost:8000',
  p5RunnerUrl: undefined,
  googleMapsApiKey: undefined,
  editorImageMaxSizeBytes: 30 * 1024 * 1024,
  authCodeLifespanSeconds: 15 * 60,
  authCodeResendCooldownSeconds: 60,
};

interface RawPublicRuntimeConfig {
  cdnUrl?: string;
  fontBaseUrl?: string;
  apiUrl?: string;
  p5RunnerUrl?: string;
  googleMapsApiKey?: string;
  editorImageMaxSizeBytes?: string;
  authCodeLifespanSeconds?: string;
  authCodeResendCooldownSeconds?: string;
}

function optionalText(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function withoutTrailingSlash(value: string | undefined): string | undefined {
  return optionalText(value)?.replace(/\/+$/, '');
}

function positiveInteger(value: string | undefined, fallback: number): number {
  const text = optionalText(value);
  const parsed = text === undefined ? Number.NaN : Number(text);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function decodePublicRuntimeConfig(raw: RawPublicRuntimeConfig): PublicRuntimeConfig {
  const defaults = developmentPublicRuntimeConfig;
  return {
    cdnUrl: withoutTrailingSlash(raw.cdnUrl) ?? defaults.cdnUrl,
    fontBaseUrl: withoutTrailingSlash(raw.fontBaseUrl) ?? defaults.fontBaseUrl,
    apiUrl: withoutTrailingSlash(raw.apiUrl) ?? defaults.apiUrl,
    p5RunnerUrl: withoutTrailingSlash(raw.p5RunnerUrl),
    googleMapsApiKey: optionalText(raw.googleMapsApiKey),
    editorImageMaxSizeBytes: positiveInteger(raw.editorImageMaxSizeBytes, defaults.editorImageMaxSizeBytes),
    authCodeLifespanSeconds: positiveInteger(raw.authCodeLifespanSeconds, defaults.authCodeLifespanSeconds),
    authCodeResendCooldownSeconds: positiveInteger(
      raw.authCodeResendCooldownSeconds,
      defaults.authCodeResendCooldownSeconds,
    ),
  };
}

/** Normalized environment values; the server module validates this same projection. */
export function readPublicRuntimeEnvironment(): PublicRuntimeConfig {
  return decodePublicRuntimeConfig({
    cdnUrl: process.env.PUBLIC_CDN_URL,
    fontBaseUrl: process.env.PUBLIC_FONT_BASE_URL,
    apiUrl: process.env.PUBLIC_API_URL,
    p5RunnerUrl: process.env.PUBLIC_P5_RUNNER_URL,
    googleMapsApiKey: process.env.PUBLIC_GOOGLE_MAPS_API_KEY,
    editorImageMaxSizeBytes: process.env.PUBLIC_EDITOR_IMAGE_MAX_SIZE_BYTES,
    authCodeLifespanSeconds: process.env.AUTH_CODE_LIFESPAN_SECONDS,
    authCodeResendCooldownSeconds: process.env.AUTH_CODE_RESEND_COOLDOWN_SECONDS,
  });
}

let cachedBrowserConfig: PublicRuntimeConfig | null = null;

function readBrowserRuntimeConfig(): PublicRuntimeConfig {
  if (cachedBrowserConfig) {
    return cachedBrowserConfig;
  }
  const dataset = document.documentElement.dataset;
  if (!dataset.geulCdnUrl || !dataset.geulApiUrl) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Geul public runtime config is missing from <html data-geul-*>; render under the root layout.');
    }
    // Development documents without the root layout (tests, Storybook without fixtures) use local services.
    return developmentPublicRuntimeConfig;
  }
  cachedBrowserConfig = decodePublicRuntimeConfig({
    cdnUrl: dataset.geulCdnUrl,
    fontBaseUrl: dataset.geulFontBaseUrl,
    apiUrl: dataset.geulApiUrl,
    p5RunnerUrl: dataset.geulP5RunnerUrl,
    googleMapsApiKey: dataset.geulGoogleMapsApiKey,
    editorImageMaxSizeBytes: dataset.geulEditorImageMaxSizeBytes,
    authCodeLifespanSeconds: dataset.geulAuthCodeLifespanSeconds,
    authCodeResendCooldownSeconds: dataset.geulAuthCodeResendCooldownSeconds,
  });
  return cachedBrowserConfig;
}

function getPublicRuntimeConfig(): PublicRuntimeConfig {
  return typeof window === 'undefined' ? readPublicRuntimeEnvironment() : readBrowserRuntimeConfig();
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

export function getPublicFontBaseUrl(): string {
  return getPublicRuntimeConfig().fontBaseUrl;
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
