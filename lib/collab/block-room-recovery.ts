import {
  createBlockRoomDocumentName,
  type BlockRoomBootstrap,
  type BlockRoomDocumentType,
} from './block-room-bootstrap';

export interface BlockRoomRecoveryScope {
  documentType: BlockRoomDocumentType;
  entityId: string;
  locale: string | null;
}

/**
 * A local recovery snapshot pairs the last admitted canonical revision with a
 * full copy of the resident Yjs state. It is never applied to a new document.
 */
export interface BlockRoomRecoverySnapshot {
  documentType: BlockRoomDocumentType;
  entityId: string;
  locale: string;
  capturedAt: number;
  sourceLocale: string;
  canonicalDocument: BlockRoomBootstrap['document'];
  documentRevision: string;
  targetRevision?: string;
  yjsUpdate: Uint8Array;
}

export interface CreateBlockRoomRecoverySnapshotInput extends BlockRoomRecoveryScope {
  admitted: boolean;
  bootstrap: BlockRoomBootstrap | null;
  yjsUpdate: Uint8Array;
  capturedAt?: number;
}

export function createBlockRoomRecoverySnapshot(
  input: CreateBlockRoomRecoverySnapshotInput,
): BlockRoomRecoverySnapshot | null {
  const { documentType, entityId, locale, bootstrap } = input;
  if (!input.admitted || !locale || !bootstrap) {
    return null;
  }

  let expectedDocumentName: string;
  try {
    expectedDocumentName = createBlockRoomDocumentName(documentType, entityId, locale);
  } catch {
    return null;
  }
  if (
    bootstrap.documentType !== documentType ||
    bootstrap.locale !== locale ||
    bootstrap.documentName !== expectedDocumentName
  ) {
    return null;
  }

  return {
    documentType,
    entityId,
    locale,
    capturedAt: input.capturedAt ?? Date.now(),
    sourceLocale: bootstrap.sourceLocale,
    canonicalDocument: structuredClone(bootstrap.document),
    documentRevision: bootstrap.documentRevision,
    ...(bootstrap.targetRevision === undefined ? {} : { targetRevision: bootstrap.targetRevision }),
    yjsUpdate: Uint8Array.from(input.yjsUpdate),
  };
}

export function matchesBlockRoomRecoveryScope(
  snapshot: BlockRoomRecoverySnapshot | null,
  scope: BlockRoomRecoveryScope,
): snapshot is BlockRoomRecoverySnapshot {
  return (
    snapshot !== null &&
    scope.locale !== null &&
    snapshot.documentType === scope.documentType &&
    snapshot.entityId === scope.entityId &&
    snapshot.locale === scope.locale
  );
}

export function retainBlockRoomRecoverySnapshot(
  current: BlockRoomRecoverySnapshot | null,
  candidate: BlockRoomRecoverySnapshot,
  hasNewLocalChanges: boolean,
): BlockRoomRecoverySnapshot {
  if (!matchesBlockRoomRecoveryScope(current, candidate)) {
    return candidate;
  }
  return hasNewLocalChanges ? candidate : current;
}
