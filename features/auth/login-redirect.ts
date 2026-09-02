import { getPublicAuthUrl } from '@/lib/public-runtime-config';

export const AUTH_REDIRECT_STORAGE_KEY = 'auth_redirect';
const NEWSLETTER_AUTH_CONTINUATION_STORAGE_KEY = 'newsletter_auth_continuation';

interface StorageLike {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
}

interface BuildLoginBrowserUrlOptions {
  refresh?: boolean;
  returnTo?: string | null;
}

interface StartPrivilegedReauthenticationOptions {
  assign?: (url: string) => void;
  origin?: string;
  storage?: StorageLike;
}

interface ResolveLoginSuccessRedirectOptions {
  storedRedirect?: string | null;
  flowReturnTo?: string | null;
  redirectUrl?: string | null;
  origin: string;
}

export interface NewsletterAuthContinuation {
  redirectUrl: string;
}

export function resolveDirectNewsletterEntry(query: string, origin: string): NewsletterAuthContinuation | null {
  const searchParams = new URLSearchParams(query);
  const parameterNames = Array.from(searchParams.keys());
  if (
    searchParams.getAll('intent').length !== 1 ||
    searchParams.get('intent') !== 'newsletter' ||
    searchParams.getAll('redirect').length > 1 ||
    parameterNames.some((name) => name !== 'intent' && name !== 'redirect')
  ) {
    return null;
  }

  const redirectValues = searchParams.getAll('redirect');
  if (redirectValues.length === 0) {
    return { redirectUrl: '/' };
  }

  const redirectUrl = resolveSameOriginCandidate(redirectValues[0], origin);
  return redirectUrl ? { redirectUrl } : null;
}

function resolveStorage(storage?: StorageLike): StorageLike | null {
  if (storage) {
    return storage;
  }

  if (typeof window === 'undefined') {
    return null;
  }

  return window.sessionStorage;
}

function hasControlCharacters(value: string): boolean {
  return Array.from(value).some((character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return codePoint <= 31 || codePoint === 127;
  });
}

export function rememberAuthRedirect(redirectUrl: string, storage?: StorageLike): void {
  let targetStorage: StorageLike | null;
  try {
    targetStorage = resolveStorage(storage);
  } catch {
    return;
  }
  if (!targetStorage) {
    return;
  }

  const trimmed = redirectUrl.trim();
  try {
    if (!trimmed || trimmed === '/') {
      targetStorage.removeItem(AUTH_REDIRECT_STORAGE_KEY);
      return;
    }

    targetStorage.setItem(AUTH_REDIRECT_STORAGE_KEY, trimmed);
  } catch {
    // Authentication still continues through the provider's return_to value.
  }
}

export function consumeAuthRedirect(storage?: StorageLike): string | null {
  let targetStorage: StorageLike | null;
  try {
    targetStorage = resolveStorage(storage);
  } catch {
    return null;
  }
  if (!targetStorage) {
    return null;
  }

  try {
    const stored = targetStorage.getItem(AUTH_REDIRECT_STORAGE_KEY);
    targetStorage.removeItem(AUTH_REDIRECT_STORAGE_KEY);
    return stored;
  } catch {
    return null;
  }
}

export function clearAuthRedirect(storage?: StorageLike): void {
  try {
    resolveStorage(storage)?.removeItem(AUTH_REDIRECT_STORAGE_KEY);
  } catch {
    // Unavailable browser storage already behaves as cleared.
  }
}

export function buildLoginBrowserUrl({ refresh = false, returnTo }: BuildLoginBrowserUrlOptions = {}): string {
  const url = new URL(`${getPublicAuthUrl()}/login`, 'https://app.local');
  if (refresh) {
    url.searchParams.set('refresh', 'true');
  }
  if (returnTo?.trim()) {
    url.searchParams.set('return_to', returnTo.trim());
  }
  return `${url.pathname}${url.search}${url.hash}`;
}

export function buildLoginFlowUrl(flowId: string): string {
  const url = new URL(`${getPublicAuthUrl()}/login/flows`, 'https://app.local');
  url.searchParams.set('id', flowId);
  return `${url.pathname}${url.search}${url.hash}`;
}

export function buildLoginSubmitUrl(flowId: string): string {
  const url = new URL(`${getPublicAuthUrl()}/login`, 'https://app.local');
  url.searchParams.set('flow', flowId);
  return `${url.pathname}${url.search}${url.hash}`;
}

export function resolveSameOriginLoginReturnTo(redirectUrl: string, origin: string): string {
  const fallback = new URL('/', origin);
  const candidate = resolveSameOriginCandidate(redirectUrl, fallback.origin);
  return candidate ? new URL(candidate, fallback.origin).toString() : fallback.toString();
}

function resolveSameOriginCandidate(candidate: string | null | undefined, origin: string): string | null {
  const trimmed = candidate?.trim();
  if (!trimmed || trimmed.startsWith('//') || hasControlCharacters(trimmed)) {
    return null;
  }

  try {
    const target = new URL(trimmed, origin);
    const expectedOrigin = new URL(origin).origin;
    if (
      target.origin !== expectedOrigin ||
      target.username !== '' ||
      target.password !== '' ||
      (target.protocol !== 'http:' && target.protocol !== 'https:')
    ) {
      return null;
    }

    return trimmed.startsWith('/') ? `${target.pathname}${target.search}${target.hash}` : target.toString();
  } catch {
    return null;
  }
}

export function buildNewsletterAuthContinuation(redirectUrl: string, origin: string): string {
  const safeRedirect = resolveSameOriginCandidate(redirectUrl, origin) ?? '/';
  const continuation = new URL('/login', origin);
  continuation.searchParams.set('intent', 'newsletter');
  continuation.searchParams.set('redirect', safeRedirect);
  return `${continuation.pathname}${continuation.search}`;
}

export function resolveNewsletterAuthContinuation(
  candidate: string | null | undefined,
  origin: string,
): NewsletterAuthContinuation | null {
  const trustedCandidate = resolveSameOriginCandidate(candidate, origin);
  if (!trustedCandidate) {
    return null;
  }

  const continuation = new URL(trustedCandidate, origin);
  const parameterNames = Array.from(continuation.searchParams.keys());
  if (
    continuation.pathname !== '/login' ||
    continuation.hash !== '' ||
    continuation.searchParams.getAll('intent').length !== 1 ||
    continuation.searchParams.get('intent') !== 'newsletter' ||
    continuation.searchParams.getAll('redirect').length !== 1 ||
    parameterNames.some((name) => name !== 'intent' && name !== 'redirect')
  ) {
    return null;
  }

  const redirectUrl = resolveSameOriginCandidate(continuation.searchParams.get('redirect'), origin);
  return redirectUrl ? { redirectUrl } : null;
}

interface StoredNewsletterAuthContinuation {
  continuation: string;
  flowId: string | null;
}

function readStoredNewsletterAuthContinuation(
  origin: string,
  storage?: StorageLike,
): StoredNewsletterAuthContinuation | null {
  let targetStorage: StorageLike | null;
  try {
    targetStorage = resolveStorage(storage);
  } catch {
    return null;
  }
  if (!targetStorage) {
    return null;
  }

  try {
    const serialized = targetStorage.getItem(NEWSLETTER_AUTH_CONTINUATION_STORAGE_KEY);
    if (!serialized) {
      return null;
    }
    const parsed = JSON.parse(serialized) as Partial<StoredNewsletterAuthContinuation>;
    const flowId = parsed.flowId;
    if (
      typeof parsed.continuation !== 'string' ||
      (flowId !== null && typeof flowId !== 'string') ||
      (typeof flowId === 'string' && !flowId.trim())
    ) {
      targetStorage.removeItem(NEWSLETTER_AUTH_CONTINUATION_STORAGE_KEY);
      return null;
    }
    const resolved = resolveNewsletterAuthContinuation(parsed.continuation, origin);
    if (!resolved) {
      targetStorage.removeItem(NEWSLETTER_AUTH_CONTINUATION_STORAGE_KEY);
      return null;
    }
    return {
      continuation: buildNewsletterAuthContinuation(resolved.redirectUrl, origin),
      flowId,
    };
  } catch {
    try {
      targetStorage.removeItem(NEWSLETTER_AUTH_CONTINUATION_STORAGE_KEY);
    } catch {
      // Unavailable browser storage already behaves as cleared.
    }
    return null;
  }
}

export function rememberNewsletterAuthContinuation(
  candidate: string,
  origin: string,
  flowId: string | null = null,
  storage?: StorageLike,
): void {
  const resolved = resolveNewsletterAuthContinuation(candidate, origin);
  if (!resolved || (flowId !== null && !flowId.trim())) {
    clearNewsletterAuthContinuation(storage);
    return;
  }

  let targetStorage: StorageLike | null;
  try {
    targetStorage = resolveStorage(storage);
  } catch {
    return;
  }
  if (!targetStorage) {
    return;
  }
  try {
    targetStorage.setItem(
      NEWSLETTER_AUTH_CONTINUATION_STORAGE_KEY,
      JSON.stringify({
        continuation: buildNewsletterAuthContinuation(resolved.redirectUrl, origin),
        flowId,
      } satisfies StoredNewsletterAuthContinuation),
    );
  } catch {
    // The identity return_to remains authoritative when storage is unavailable.
  }
}

export function claimNewsletterAuthContinuation(
  flowId: string,
  origin: string,
  storage?: StorageLike,
): NewsletterAuthContinuation | null {
  if (!flowId.trim()) {
    clearNewsletterAuthContinuation(storage);
    return null;
  }
  const stored = readStoredNewsletterAuthContinuation(origin, storage);
  if (!stored || (stored.flowId !== null && stored.flowId !== flowId)) {
    clearNewsletterAuthContinuation(storage);
    return null;
  }
  rememberNewsletterAuthContinuation(stored.continuation, origin, flowId, storage);
  return resolveNewsletterAuthContinuation(stored.continuation, origin);
}

export function clearNewsletterAuthContinuation(storage?: StorageLike): void {
  try {
    resolveStorage(storage)?.removeItem(NEWSLETTER_AUTH_CONTINUATION_STORAGE_KEY);
  } catch {
    // Unavailable browser storage already behaves as cleared.
  }
}

function resolveTrustedFlowReturnTo(candidate: string | null | undefined, origin: string): string | null {
  const trimmed = candidate?.trim();
  if (!trimmed || trimmed.startsWith('//') || hasControlCharacters(trimmed)) {
    return null;
  }

  try {
    const target = new URL(trimmed, origin);
    if (
      (target.protocol !== 'http:' && target.protocol !== 'https:') ||
      target.username !== '' ||
      target.password !== ''
    ) {
      return null;
    }
    return trimmed.startsWith('/') ? `${target.pathname}${target.search}${target.hash}` : target.toString();
  } catch {
    return null;
  }
}

export function resolveAuthFlowContinuation({
  flowReturnTo,
  redirectUrl,
  origin,
}: Pick<ResolveLoginSuccessRedirectOptions, 'flowReturnTo' | 'redirectUrl' | 'origin'>): string {
  return resolveTrustedFlowReturnTo(flowReturnTo, origin) ?? resolveSameOriginCandidate(redirectUrl, origin) ?? '/';
}

export function resolveLoginSuccessRedirect({
  storedRedirect,
  flowReturnTo,
  redirectUrl,
  origin,
}: ResolveLoginSuccessRedirectOptions): string {
  const stored = resolveSameOriginCandidate(storedRedirect, origin);
  if (stored) {
    return stored;
  }

  const kratosReturnTo = resolveTrustedFlowReturnTo(flowReturnTo, origin);
  if (kratosReturnTo) {
    return kratosReturnTo;
  }

  return resolveSameOriginCandidate(redirectUrl, origin) ?? '/';
}

export function startPrivilegedReauthentication(
  returnTo: string,
  options: StartPrivilegedReauthenticationOptions = {},
): void {
  const origin = options.origin ?? (typeof window === 'undefined' ? 'http://localhost' : window.location.origin);
  const safeReturnTo = resolveSameOriginCandidate(returnTo, origin) ?? '/';
  rememberAuthRedirect(safeReturnTo, options.storage);

  const assign =
    options.assign ??
    ((url: string) => {
      window.location.href = url;
    });

  const url = new URL(`${getPublicAuthUrl()}/login`, 'https://app.local');
  url.searchParams.set('refresh', 'true');
  url.searchParams.set('return_to', safeReturnTo);
  assign(`${url.pathname}${url.search}${url.hash}`);
}
