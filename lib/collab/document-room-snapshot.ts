import { CollaborativeDocumentType, parseDocumentName } from '@echovisionlab/geul-common/collaboration/document';
import type { RuntimeEntityType } from '@echovisionlab/geul-common/collaboration/runtime-events';
import type * as Y from 'yjs';

export const DOCUMENT_ROOM_SNAPSHOT_MAP_NAME = 'collaboration-revision';
export const DOCUMENT_ROOM_SNAPSHOT_KEYS = {
  documentName: 'documentName',
  documentRevision: 'documentRevision',
  sourceLocale: 'sourceLocale',
  locale: 'locale',
  localeExists: 'localeExists',
  targetRevision: 'targetRevision',
} as const;

export interface DocumentRoomSnapshot {
  documentName: string;
  documentRevision: string;
  sourceLocale: string;
  locale: string;
  localeExists: boolean;
  targetRevision?: string;
}

export type DocumentRoomSnapshotEntityType = RuntimeEntityType | 'post_series';

const documentTypeByEntityType: Partial<Record<DocumentRoomSnapshotEntityType, CollaborativeDocumentType>> = {
  email_layout: CollaborativeDocumentType.EMAIL_LAYOUT,
  form: CollaborativeDocumentType.FORM,
  menu: CollaborativeDocumentType.MENU,
  post_series: CollaborativeDocumentType.POST_SERIES,
};

const canonicalRevisionPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function isCanonicalLocale(value: string): boolean {
  try {
    return Intl.getCanonicalLocales(value)[0] === value;
  } catch {
    return false;
  }
}

/**
 * Read only a server-projected document baseline that matches the expected
 * entity and (when supplied) the Hocuspocus provider's exact room name.
 */
export function getDocumentRoomSnapshot(
  document: Y.Doc | null | undefined,
  expected: {
    entityType: DocumentRoomSnapshotEntityType;
    entityId: string;
    documentName?: string;
  },
): DocumentRoomSnapshot | null {
  if (!document) {
    return null;
  }

  const expectedDocumentType = documentTypeByEntityType[expected.entityType];
  if (expectedDocumentType === undefined) {
    return null;
  }

  const metadata = document.getMap<string | boolean>(DOCUMENT_ROOM_SNAPSHOT_MAP_NAME);
  const documentName = metadata.get(DOCUMENT_ROOM_SNAPSHOT_KEYS.documentName);
  const documentRevision = metadata.get(DOCUMENT_ROOM_SNAPSHOT_KEYS.documentRevision);
  const sourceLocale = metadata.get(DOCUMENT_ROOM_SNAPSHOT_KEYS.sourceLocale);
  const locale = metadata.get(DOCUMENT_ROOM_SNAPSHOT_KEYS.locale);
  const localeExists = metadata.get(DOCUMENT_ROOM_SNAPSHOT_KEYS.localeExists);
  const targetRevision = metadata.get(DOCUMENT_ROOM_SNAPSHOT_KEYS.targetRevision);

  if (
    typeof documentName !== 'string' ||
    typeof documentRevision !== 'string' ||
    typeof sourceLocale !== 'string' ||
    typeof locale !== 'string' ||
    typeof localeExists !== 'boolean' ||
    (targetRevision !== undefined && typeof targetRevision !== 'string')
  ) {
    return null;
  }

  try {
    const parsed = parseDocumentName(documentName);
    if (
      parsed.type !== expectedDocumentType ||
      parsed.entityId !== expected.entityId ||
      parsed.locale !== locale ||
      (expected.documentName !== undefined && expected.documentName !== documentName)
    ) {
      return null;
    }
  } catch {
    return null;
  }

  if (
    !canonicalRevisionPattern.test(documentRevision) ||
    !isCanonicalLocale(sourceLocale) ||
    !isCanonicalLocale(locale)
  ) {
    return null;
  }

  if (locale === sourceLocale) {
    if (!localeExists || targetRevision !== undefined) {
      return null;
    }
  } else if (localeExists && !targetRevision) {
    return null;
  }

  return {
    documentName,
    documentRevision,
    sourceLocale,
    locale,
    localeExists,
    ...(targetRevision === undefined ? {} : { targetRevision }),
  };
}
