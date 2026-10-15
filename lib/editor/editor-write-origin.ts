'use client';

import { getActiveMember } from '@/lib/auth/active-member';
import { createEditorWriteToken, parseEditorWriteToken } from './editor-write-token';

// A module instance belongs to a browser tab. Never persist this in member/session storage.
let tabOrigin: string | undefined;
export function getEditorWriteOrigin(): string {
  return (tabOrigin ??= globalThis.crypto.randomUUID());
}

/** The token a configuration write sends: this tab's origin bound to the active member. */
export function getEditorWriteToken(): string {
  return createEditorWriteToken(getEditorWriteOrigin(), getActiveMember());
}

interface OriginWrites {
  owner: symbol;
  mixedOwners: boolean;
  pending: number;
  unadopted: boolean;
  adopted: boolean;
}
// Aggregate per entity: save frequency must not grow the ledger.
const writes = new Map<string, OriginWrites>();

export function registerConfigurationOriginWrite(entity: string, owner: symbol) {
  const entityKey = entity.replaceAll('_', '-');
  const entries = writes.get(entityKey) ?? { owner, mixedOwners: false, pending: 0, unadopted: false, adopted: false };
  entries.mixedOwners ||= entries.owner !== owner;
  entries.pending += 1;
  writes.set(entityKey, entries);
  let settled = false;
  return (adopted: boolean) => {
    if (settled) {
      return;
    }
    settled = true;
    entries.pending -= 1;
    entries.unadopted ||= !adopted;
    entries.adopted ||= adopted;
  };
}

/** No suppression proof crosses editor slices, failed writes, or outstanding writes. */
export function hasAdoptedConfigurationOrigin(entity: string, owner: symbol, origin?: string): boolean {
  if (!origin || parseEditorWriteToken(origin).origin !== getEditorWriteOrigin()) {
    return false;
  }
  const entries = writes.get(entity.replaceAll('_', '-'));
  return Boolean(
    entries &&
    entries.owner === owner &&
    !entries.mixedOwners &&
    !entries.pending &&
    !entries.unadopted &&
    entries.adopted,
  );
}

/** Origin-bearing legacy/recovery writes without a canonical adopter must keep hints active. */
export function getUntrackedConfigurationWriteOrigin(entity: string): string {
  registerConfigurationOriginWrite(entity, Symbol('untracked-configuration-write'))(false);
  return getEditorWriteToken();
}
