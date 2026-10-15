/**
 * The member whose edits this page may keep. Unsaved-edit journals and backups are written,
 * adopted and restored only under this member, so a shared browser never saves one account's
 * edits under another.
 *
 * - A lost session (timeout, revoked elsewhere) keeps the member: its unsaved edits must survive
 *   until the same member signs in again.
 * - A different member in the same page is a switch: the page reloads so no in-memory edit of the
 *   previous member can reach the new session.
 * - Signing out, in this tab or another, ends the member for the rest of this page: nothing of
 *   theirs is written again.
 */

const CHANNEL_NAME = 'geul:active-member:v1';

let activeMemberId: string | null = null;
let signingOutHere = false;
const signedOutMembers = new Set<string>();
const signedOutListeners = new Set<(memberId: string) => void>();
let channel: BroadcastChannel | null | undefined;

function memberChannel(): BroadcastChannel | null {
  if (channel !== undefined) {
    return channel;
  }
  channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(CHANNEL_NAME);
  channel?.addEventListener('message', ({ data }: MessageEvent<unknown>) => {
    if (
      data &&
      typeof data === 'object' &&
      'signedOut' in data &&
      typeof data.signedOut === 'string' &&
      data.signedOut.length > 0
    ) {
      endMember(data.signedOut);
    }
  });
  return channel;
}

function endMember(memberId: string): void {
  if (signedOutMembers.has(memberId)) {
    return;
  }
  signedOutMembers.add(memberId);
  for (const listener of signedOutListeners) {
    listener(memberId);
  }
}

export type ActiveMemberSync = 'unchanged' | 'adopted' | 'switched';

/**
 * Records the signed-in member reported by the session. Returns `switched` when the page already
 * holds another member's edits; the caller must then reload the page (the previous member stays
 * active until it does).
 */
export function syncActiveMember(memberId: string): ActiveMemberSync {
  // Page state of a browser tab only: a server process renders many members' requests.
  if (typeof window === 'undefined') {
    return 'unchanged';
  }
  memberChannel();
  if (activeMemberId === memberId) {
    return 'unchanged';
  }
  // Even a signed-out previous member left in-memory journals in this page.
  if (activeMemberId !== null) {
    return 'switched';
  }
  activeMemberId = memberId;
  return 'adopted';
}

/** The member whose edits may be persisted now, or null. */
export function getActiveMember(): string | null {
  return activeMemberId !== null && !signedOutMembers.has(activeMemberId) ? activeMemberId : null;
}

export function isSignedOutMember(memberId: string): boolean {
  return signedOutMembers.has(memberId);
}

/** Ends the active member in this tab and every other tab of this browser. */
export function announceSignOut(): string | null {
  const memberId = getActiveMember();
  if (!memberId) {
    return null;
  }
  signingOutHere = true;
  memberChannel()?.postMessage({ signedOut: memberId });
  endMember(memberId);
  return memberId;
}

/** Whether `memberId` is the member this page holds edits for, signed out or not. */
export function isPageMember(memberId: string): boolean {
  return activeMemberId === memberId;
}

/** True once this tab started signing out (its own logout navigation is under way). */
export function isSigningOutHere(): boolean {
  return signingOutHere;
}

/** Observes members signing out here or in another tab. */
export function subscribeSignedOutMembers(listener: (memberId: string) => void): () => void {
  memberChannel();
  signedOutListeners.add(listener);
  return () => {
    signedOutListeners.delete(listener);
  };
}

/** Test seam: forget page state. */
export function resetActiveMemberForTests(): void {
  activeMemberId = null;
  signingOutHere = false;
  signedOutMembers.clear();
  signedOutListeners.clear();
  channel?.close();
  channel = undefined;
}
