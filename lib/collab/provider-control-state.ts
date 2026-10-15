import { createLogger } from '@/lib/utils/logger';
import type { AccessEndedReason, AccessLevel } from '@echovisionlab/geul-common/collaboration/protocol';

// Control-plane state belongs to a provider generation, never to its replacement.
const revisions = new WeakMap<object, string>();
const endedAccess = new WeakMap<object, AccessEndedReason>();
const accessListeners = new Set<(reason: AccessEndedReason, provider: object) => void>();

export function setProviderDocumentRevision(provider: object, revision: string): void {
  revisions.set(provider, revision);
}

export function getProviderDocumentRevision(provider: object): string | undefined {
  return revisions.get(provider);
}

export function endProviderAccess(provider: object, reason: AccessEndedReason): void {
  if (endedAccess.has(provider)) {
    return;
  }
  endedAccess.set(provider, reason);
  for (const listener of accessListeners) {
    try {
      listener(reason, provider);
    } catch (error) {
      void createLogger('collaboration').warn('Access-ended listener failed', { data: { error: String(error) } });
    }
  }
}

export function subscribeToCollaborationAccessEnded(
  listener: (reason: AccessEndedReason, provider: object) => void,
): () => void {
  accessListeners.add(listener);
  return () => {
    accessListeners.delete(listener);
  };
}

export function getProviderAccessEnded(provider: object | null | undefined): AccessEndedReason | undefined {
  return provider ? endedAccess.get(provider) : undefined;
}

// Providers whose editor renders its own access-ended dialogs (useEditorPermissionRevocation).
const interruptionHandlers = new WeakMap<object, number>();

/** An editor takes over the access-ended dialog for `provider`; the app-wide fallback stays quiet. */
export function claimProviderInterruptionHandling(provider: object): () => void {
  interruptionHandlers.set(provider, (interruptionHandlers.get(provider) ?? 0) + 1);
  return () => {
    const count = (interruptionHandlers.get(provider) ?? 1) - 1;
    if (count > 0) {
      interruptionHandlers.set(provider, count);
    } else {
      interruptionHandlers.delete(provider);
    }
  };
}

export function isProviderInterruptionHandled(provider: object): boolean {
  return (interruptionHandlers.get(provider) ?? 0) > 0;
}

/** Maps a connect-time authentication failure to ended access, like `room.access_ended`. */
export function accessEndedReasonFromAuthenticationFailure(reason: string): AccessEndedReason | undefined {
  return reason === 'session_expired' || reason === 'permission_revoked' ? reason : undefined;
}

// Access level of an open room connection; editing stops in place on `view` (room.access_changed).
const accessLevels = new WeakMap<object, AccessLevel>();
const accessLevelListeners = new Set<(access: AccessLevel, provider: object, changed: boolean) => void>();

/**
 * Records the room's access level. `changed` is true for a change while the room was open
 * (room.access_changed) and false for the level the connection was opened with.
 */
export function setProviderAccessLevel(provider: object, access: AccessLevel, changed = true): void {
  if ((accessLevels.get(provider) ?? 'edit') === access) {
    return;
  }
  accessLevels.set(provider, access);
  notifyAccessLevel(access, provider, changed);
}

/**
 * Records the level a room reported (room.access_changed, sent on every admission). `previous` is
 * the last level the same room reported through any provider generation, so a change made while
 * the provider was replaced or reconnecting still counts as a change; a new provider starts at
 * `edit` and would otherwise miss an upgrade. Returns whether the level changed.
 */
export function reportRoomAccessLevel(
  provider: object,
  access: AccessLevel,
  previous: AccessLevel | undefined,
): boolean {
  const changed = previous !== undefined && previous !== access;
  const current = accessLevels.get(provider) ?? 'edit';
  accessLevels.set(provider, access);
  if (current !== access || changed) {
    notifyAccessLevel(access, provider, changed);
  }
  return changed;
}

function notifyAccessLevel(access: AccessLevel, provider: object, changed: boolean): void {
  for (const listener of accessLevelListeners) {
    try {
      listener(access, provider, changed);
    } catch (error) {
      void createLogger('collaboration').warn('Access-level listener failed', { data: { error: String(error) } });
    }
  }
}

/** `edit` until the room reports otherwise; a provider without access ended is not editable either. */
export function getProviderAccessLevel(provider: object | null | undefined): AccessLevel {
  return provider ? (accessLevels.get(provider) ?? 'edit') : 'edit';
}

export function subscribeToProviderAccessLevel(
  listener: (access: AccessLevel, provider: object, changed: boolean) => void,
): () => void {
  accessLevelListeners.add(listener);
  return () => {
    accessLevelListeners.delete(listener);
  };
}
