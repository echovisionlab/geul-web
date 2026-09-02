import type { SessionInfo } from '@/lib/types/user/model';

export const SECURITY_PRIVILEGED_SESSION_MAX_AGE_MS = 3 * 60 * 60 * 1000;
export const SECURITY_CONTINUATION_MAX_AGE_MS = 10 * 60 * 1000;
export const ACCOUNT_SECURITY_CONTINUATION_PARAM = 'resume_account_security_action';
export const PASSKEY_SECURITY_CONTINUATION_PARAM = 'resume_passkey_security_action';
export const EMAIL_VERIFICATION_CONTINUATION_PARAM = 'resume_email_verification';

const ACCOUNT_SECURITY_CONTINUATION_KEY = 'account_security_continuation';
const PASSKEY_SECURITY_CONTINUATION_KEY = 'passkey_security_continuation';
const EMAIL_VERIFICATION_CONTINUATION_KEY = 'email_verification_continuation';

interface StorageLike {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
}

export type AccountSecurityContinuation =
  | { action: 'revoke_session'; id: string }
  | { action: 'revoke_other_sessions' }
  | { action: 'request_account_deletion' };

export type PasskeySecurityContinuation = { action: 'add_passkey' } | { action: 'remove_passkey'; id: string };

export interface EmailVerificationContinuation {
  mode: 'change';
  email: string;
  operation: 'start' | 'restart';
}

function browserStorage(storage?: StorageLike): StorageLike | null {
  if (storage) {
    return storage;
  }
  return typeof window === 'undefined' ? null : window.sessionStorage;
}

function remember(key: string, value: unknown, subjectId: string, storage?: StorageLike): void {
  try {
    if (!nonEmptyString(subjectId)) {
      return;
    }
    browserStorage(storage)?.setItem(key, JSON.stringify({ issuedAtMs: Date.now(), subjectId, value }));
  } catch {
    // The server still enforces freshness; unavailable storage only prevents automatic continuation.
  }
}

function consume(key: string, subjectId: string, storage?: StorageLike): unknown {
  try {
    const target = browserStorage(storage);
    const raw = target?.getItem(key);
    target?.removeItem(key);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as { issuedAtMs?: unknown; subjectId?: unknown; value?: unknown };
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      typeof parsed.issuedAtMs !== 'number' ||
      !nonEmptyString(parsed.subjectId) ||
      parsed.subjectId !== subjectId ||
      !Number.isFinite(parsed.issuedAtMs) ||
      parsed.issuedAtMs > Date.now() ||
      parsed.issuedAtMs < Date.now() - SECURITY_CONTINUATION_MAX_AGE_MS
    ) {
      return null;
    }
    return parsed.value;
  } catch {
    return null;
  }
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function rememberAccountSecurityContinuation(
  continuation: AccountSecurityContinuation,
  subjectId: string,
  storage?: StorageLike,
): void {
  remember(ACCOUNT_SECURITY_CONTINUATION_KEY, continuation, subjectId, storage);
}

export function consumeAccountSecurityContinuation(
  subjectId: string,
  storage?: StorageLike,
): AccountSecurityContinuation | null {
  const value = consume(ACCOUNT_SECURITY_CONTINUATION_KEY, subjectId, storage);
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  const candidate = value as { action?: unknown; email?: unknown; id?: unknown };
  if (candidate.action === 'revoke_session' && 'id' in candidate && nonEmptyString(candidate.id)) {
    return candidate as AccountSecurityContinuation;
  }
  return candidate.action === 'revoke_other_sessions' || candidate.action === 'request_account_deletion'
    ? (candidate as AccountSecurityContinuation)
    : null;
}

export function rememberPasskeySecurityContinuation(
  continuation: PasskeySecurityContinuation,
  subjectId: string,
  storage?: StorageLike,
): void {
  remember(PASSKEY_SECURITY_CONTINUATION_KEY, continuation, subjectId, storage);
}

export function consumePasskeySecurityContinuation(
  subjectId: string,
  storage?: StorageLike,
): PasskeySecurityContinuation | null {
  const value = consume(PASSKEY_SECURITY_CONTINUATION_KEY, subjectId, storage);
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  const candidate = value as { action?: unknown; id?: unknown };
  if (candidate.action === 'add_passkey') {
    return { action: 'add_passkey' };
  }
  return candidate.action === 'remove_passkey' && nonEmptyString(candidate.id)
    ? { action: 'remove_passkey', id: candidate.id }
    : null;
}

export function rememberEmailVerificationContinuation(
  continuation: EmailVerificationContinuation,
  subjectId: string,
  storage?: StorageLike,
): void {
  remember(EMAIL_VERIFICATION_CONTINUATION_KEY, continuation, subjectId, storage);
}

export function consumeEmailVerificationContinuation(
  subjectId: string,
  storage?: StorageLike,
): EmailVerificationContinuation | null {
  const value = consume(EMAIL_VERIFICATION_CONTINUATION_KEY, subjectId, storage);
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  const candidate = value as { mode?: unknown; email?: unknown; operation?: unknown };
  return (candidate.mode === 'add' || candidate.mode === 'change') &&
    (candidate.operation === 'start' || candidate.operation === 'restart') &&
    nonEmptyString(candidate.email)
    ? (candidate as EmailVerificationContinuation)
    : null;
}

export function accountSecurityReauthenticationReturnTo(): string {
  return `/my/security?${ACCOUNT_SECURITY_CONTINUATION_PARAM}=1`;
}

export function passkeySecurityReauthenticationReturnTo(): string {
  return `/my/security?${PASSKEY_SECURITY_CONTINUATION_PARAM}=1`;
}

export function emailVerificationReauthenticationReturnTo(): string {
  return `/verify?${EMAIL_VERIFICATION_CONTINUATION_PARAM}=1`;
}

export function isSecuritySessionFresh(
  sessions: SessionInfo[],
  nowMs = Date.now(),
  maxAgeMs = SECURITY_PRIVILEGED_SESSION_MAX_AGE_MS,
): boolean {
  const current = sessions.find((session) => session.current && session.active);
  const authenticatedAt = current?.authenticated_at ? Date.parse(current.authenticated_at) : Number.NaN;
  return Number.isFinite(authenticatedAt) && authenticatedAt <= nowMs && authenticatedAt >= nowMs - maxAgeMs;
}

export function isSecurityReauthenticationReturnTarget(returnTo: string | null | undefined): boolean {
  if (!returnTo) {
    return false;
  }
  try {
    const url = new URL(returnTo, 'https://local.invalid');
    return url.pathname === '/my/security' || url.pathname === '/verify';
  } catch {
    return false;
  }
}
