export type AuthCodePurpose = 'login' | 'registration' | 'verification';

export interface AuthCodeTimingInput {
  acceptedDeliveryAt: number | null;
  codeLifespanSeconds: number;
  flowExpiresAt?: string | null;
  resendCooldownSeconds: number;
}

export interface AuthCodeTiming {
  expiresInSeconds: number | null;
  flowExpiresInSeconds: number | null;
  resendInSeconds: number;
}

export interface AuthCodeDeliveryStorage {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
}

const AUTH_CODE_DELIVERY_STORAGE_PREFIX = 'geul.auth-code-delivery';

function remainingSeconds(deadline: number, now: number): number {
  return Math.max(0, Math.ceil((deadline - now) / 1000));
}

function parseTimestamp(value: string | null | undefined): number | null {
  if (!value) {
    return null;
  }

  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function deliveryStorageKey(purpose: AuthCodePurpose, flowId: string): string {
  return `${AUTH_CODE_DELIVERY_STORAGE_PREFIX}:${purpose}:${flowId}`;
}

function resolveStorage(storage?: AuthCodeDeliveryStorage): AuthCodeDeliveryStorage | null {
  if (storage) {
    return storage;
  }
  if (typeof window === 'undefined') {
    return null;
  }
  return window.sessionStorage;
}

export function readAcceptedAuthCodeDeliveryAt(
  purpose: AuthCodePurpose,
  flowId: string,
  storage?: AuthCodeDeliveryStorage,
): number | null {
  let raw: string | null | undefined;
  try {
    raw = resolveStorage(storage)?.getItem(deliveryStorageKey(purpose, flowId));
  } catch {
    return null;
  }
  if (!raw) {
    return null;
  }

  const acceptedAt = Number(raw);
  return Number.isFinite(acceptedAt) && acceptedAt > 0 ? acceptedAt : null;
}

export function recordAcceptedAuthCodeDelivery(
  purpose: AuthCodePurpose,
  flowId: string,
  acceptedAt: number,
  storage?: AuthCodeDeliveryStorage,
): void {
  if (!Number.isFinite(acceptedAt) || acceptedAt <= 0) {
    return;
  }
  try {
    resolveStorage(storage)?.setItem(deliveryStorageKey(purpose, flowId), String(acceptedAt));
  } catch {
    // The provider still enforces expiry and resend limits when browser storage is unavailable.
  }
}

export function clearAcceptedAuthCodeDelivery(
  purpose: AuthCodePurpose,
  flowId: string,
  storage?: AuthCodeDeliveryStorage,
): void {
  try {
    resolveStorage(storage)?.removeItem(deliveryStorageKey(purpose, flowId));
  } catch {
    // Clearing unavailable browser storage is already the desired effective state.
  }
}

export function getAuthCodeTiming(input: AuthCodeTimingInput, now: number): AuthCodeTiming {
  const acceptedAt = input.acceptedDeliveryAt == null ? null : Math.min(input.acceptedDeliveryAt, now);
  const flowExpiresAt = parseTimestamp(input.flowExpiresAt);

  return {
    expiresInSeconds: acceptedAt == null ? null : remainingSeconds(acceptedAt + input.codeLifespanSeconds * 1000, now),
    flowExpiresInSeconds: flowExpiresAt == null ? null : remainingSeconds(flowExpiresAt, now),
    resendInSeconds: acceptedAt == null ? 0 : remainingSeconds(acceptedAt + input.resendCooldownSeconds * 1000, now),
  };
}
