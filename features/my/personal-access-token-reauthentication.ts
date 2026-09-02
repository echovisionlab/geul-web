import { SECURITY_CONTINUATION_MAX_AGE_MS } from '@/features/auth/security-reauthentication';

export const PERSONAL_ACCESS_TOKEN_CONTINUATION_PARAM = 'resume_personal_access_token_action';

const PERSONAL_ACCESS_TOKEN_CONTINUATION_KEY = 'personal_access_token_continuation';

export type PersonalAccessTokenContinuation =
  { action: 'create' } | { action: 'regenerate'; id: string } | { action: 'delete'; id: string };

interface ContinuationEnvelope {
  issuedAtMs: number;
  subjectId: string;
  continuation: PersonalAccessTokenContinuation;
}

interface StorageLike {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
}

function storageKey(subjectId: string): string {
  return `${PERSONAL_ACCESS_TOKEN_CONTINUATION_KEY}:${subjectId}`;
}

function parseContinuation(value: unknown): PersonalAccessTokenContinuation | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  const candidate = value as Record<string, unknown>;
  if (candidate.action === 'create') {
    return { action: 'create' };
  }
  if (
    (candidate.action === 'regenerate' || candidate.action === 'delete') &&
    typeof candidate.id === 'string' &&
    candidate.id.length > 0
  ) {
    return { action: candidate.action, id: candidate.id };
  }
  return null;
}

export function rememberPersonalAccessTokenContinuation(
  continuation: PersonalAccessTokenContinuation,
  subjectId: string,
  storage?: Pick<StorageLike, 'setItem'>,
): void {
  try {
    const target = storage ?? (typeof window === 'undefined' ? null : window.sessionStorage);
    const envelope: ContinuationEnvelope = { issuedAtMs: Date.now(), subjectId, continuation };
    target?.setItem(storageKey(subjectId), JSON.stringify(envelope));
  } catch {
    // The server still enforces freshness; unavailable storage only prevents automatic continuation.
  }
}

export function consumePersonalAccessTokenContinuation(
  subjectId: string,
  storage?: Pick<StorageLike, 'getItem' | 'removeItem'>,
): PersonalAccessTokenContinuation | null {
  try {
    const target = storage ?? (typeof window === 'undefined' ? null : window.sessionStorage);
    const key = storageKey(subjectId);
    const raw = target?.getItem(key);
    target?.removeItem(key);
    if (!raw) {
      return null;
    }
    const envelope = JSON.parse(raw) as Partial<ContinuationEnvelope>;
    const now = Date.now();
    if (
      envelope.subjectId !== subjectId ||
      typeof envelope.issuedAtMs !== 'number' ||
      !Number.isFinite(envelope.issuedAtMs) ||
      envelope.issuedAtMs > now ||
      envelope.issuedAtMs < now - SECURITY_CONTINUATION_MAX_AGE_MS
    ) {
      return null;
    }
    return parseContinuation(envelope.continuation);
  } catch {
    return null;
  }
}

export function personalAccessTokenReauthenticationReturnTo(pathname = '/my/settings'): string {
  return `${pathname}?${PERSONAL_ACCESS_TOKEN_CONTINUATION_PARAM}=1`;
}
