import { CollaborativeDocumentType, parseDocumentName } from '@echovisionlab/geul-common/collaboration/document';
import {
  EMAIL_LAYOUT_CONTEXT_MAP_NAME,
  EMAIL_LAYOUT_HTML_TEXT_NAME,
  EMAIL_LAYOUT_UNITS_ARRAY_NAME,
  extractEmailLayoutLocaleValues,
  materializeEmailLayoutUnits,
  setEmailLayoutLocaleValue,
  unsetEmailLayoutLocaleValue,
  type EmailLayoutUnit,
} from '@echovisionlab/geul-common/collaboration/email-layout';
import {
  MENU_CONTEXT_MAP_NAME,
  MENU_ITEMS_MAP_NAME,
  extractMenuCanonicalSnapshot,
  materializeMenuCanonicalItems,
  replaceMenuCanonicalSource,
  setMenuLocaleLabel,
  unsetMenuLocaleLabel,
  type MenuCollaborationItem,
} from '@echovisionlab/geul-common/collaboration/menu';
import {
  POST_SERIES_CONTEXT_MAP_NAME,
  extractPostSeriesStoredLocaleFields,
  materializePostSeriesLocaleFields,
  setPostSeriesLocaleField,
  unsetPostSeriesLocaleField,
  type PostSeriesStoredLocaleFields,
} from '@echovisionlab/geul-common/collaboration/post-series';
import * as Y from 'yjs';
import { getDocumentRoomSnapshot, type DocumentRoomSnapshot } from './document-room-snapshot';

type DocumentRoomIntentDocumentType = 'menu' | 'post_series' | 'email_layout';
type DocumentRoomIntentRole = 'source' | 'target';

interface DocumentRoomIntentSnapshotBase extends DocumentRoomSnapshot {
  documentType: DocumentRoomIntentDocumentType;
  role: DocumentRoomIntentRole;
}

export interface MenuDocumentRoomIntentSnapshot extends DocumentRoomIntentSnapshotBase {
  documentType: 'menu';
  name: string;
  items: MenuCollaborationItem[];
  requestedLabels: Record<string, string>;
}

export interface PostSeriesDocumentRoomIntentSnapshot extends DocumentRoomIntentSnapshotBase {
  documentType: 'post_series';
  fields: PostSeriesStoredLocaleFields;
}

export interface EmailLayoutSourceDocumentRoomIntentSnapshot extends DocumentRoomIntentSnapshotBase {
  documentType: 'email_layout';
  role: 'source';
  contentHtml: string;
}

export interface EmailLayoutTargetDocumentRoomIntentSnapshot extends DocumentRoomIntentSnapshotBase {
  documentType: 'email_layout';
  role: 'target';
  units: EmailLayoutUnit[];
  localeValues: Record<string, string>;
}

export type DocumentRoomIntentSnapshot =
  | MenuDocumentRoomIntentSnapshot
  | PostSeriesDocumentRoomIntentSnapshot
  | EmailLayoutSourceDocumentRoomIntentSnapshot
  | EmailLayoutTargetDocumentRoomIntentSnapshot;

export interface DocumentRoomIntentChange {
  before: DocumentRoomIntentSnapshot;
  after: DocumentRoomIntentSnapshot;
}

export type DocumentRoomIntentErrorReason =
  | 'invalid_current_room'
  | 'document_identity_mismatch'
  | 'source_locale_mismatch'
  | 'locale_mismatch'
  | 'document_type_mismatch'
  | 'role_mismatch';

export class DocumentRoomIntentError extends Error {
  constructor(readonly reason: DocumentRoomIntentErrorReason) {
    super(`document_room_intent:${reason}`);
    this.name = 'DocumentRoomIntentError';
  }
}

const entityTypeByDocumentType: Partial<Record<CollaborativeDocumentType, DocumentRoomIntentDocumentType>> = {
  [CollaborativeDocumentType.MENU]: 'menu',
  [CollaborativeDocumentType.POST_SERIES]: 'post_series',
  [CollaborativeDocumentType.EMAIL_LAYOUT]: 'email_layout',
};

const contextMapByDocumentType: Record<DocumentRoomIntentDocumentType, string> = {
  menu: MENU_CONTEXT_MAP_NAME,
  post_series: POST_SERIES_CONTEXT_MAP_NAME,
  email_layout: EMAIL_LAYOUT_CONTEXT_MAP_NAME,
};

/** Capture the exact server-admitted document room and its typed semantic fields. */
export function captureDocumentRoomSnapshot(
  documentName: string,
  document: Y.Doc | null | undefined,
): DocumentRoomIntentSnapshot | null {
  if (!document) {
    return null;
  }

  let parsedDocumentName: ReturnType<typeof parseDocumentName>;
  try {
    parsedDocumentName = parseDocumentName(documentName);
  } catch {
    return null;
  }
  const documentType = entityTypeByDocumentType[parsedDocumentName.type];
  if (!documentType) {
    return null;
  }

  const serverSnapshot = getDocumentRoomSnapshot(document, {
    entityType: documentType,
    entityId: parsedDocumentName.entityId,
    documentName,
  });
  if (!serverSnapshot) {
    return null;
  }

  const context = document.getMap<unknown>(contextMapByDocumentType[documentType]);
  const sourceLocale = context.get('sourceLocale');
  const locale = context.get('locale');
  const localeExists = context.get('localeExists');
  if (
    sourceLocale !== serverSnapshot.sourceLocale ||
    locale !== serverSnapshot.locale ||
    localeExists !== serverSnapshot.localeExists
  ) {
    return null;
  }

  const base = {
    ...serverSnapshot,
    documentType,
    role: locale === sourceLocale ? ('source' as const) : ('target' as const),
  };

  try {
    switch (documentType) {
      case 'menu': {
        const menu = extractMenuCanonicalSnapshot(document);
        return {
          ...base,
          documentType,
          name: menu.name,
          items: cloneJson(materializeMenuCanonicalItems(document)),
          requestedLabels: cloneJson(menu.requestedLabels),
        };
      }
      case 'post_series':
        // Materialization validates the effective fields while the stored form preserves absence.
        materializePostSeriesLocaleFields(document);
        return {
          ...base,
          documentType,
          fields: cloneJson(extractPostSeriesStoredLocaleFields(document)),
        };
      case 'email_layout':
        if (base.role === 'source') {
          return {
            ...base,
            documentType,
            role: 'source',
            contentHtml: document.getText(EMAIL_LAYOUT_HTML_TEXT_NAME).toString(),
          };
        }
        return {
          ...base,
          documentType,
          role: 'target',
          units: cloneJson(materializeEmailLayoutUnits(document).map(toEmailLayoutUnit)),
          localeValues: cloneJson(extractEmailLayoutLocaleValues(document)),
        };
    }
  } catch {
    return null;
  }
}

/**
 * Rebase semantic changes from a stale source Y.Doc onto the current server
 * snapshot. The current document is changed only after the staged replay passes
 * the domain adapter's validation.
 */
export function replayDocumentRoomChanges(
  documentName: string,
  current: Y.Doc,
  changes: readonly DocumentRoomIntentChange[],
  origin: unknown,
): void {
  const currentSnapshot = captureDocumentRoomSnapshot(documentName, current);
  if (!currentSnapshot) {
    throw new DocumentRoomIntentError('invalid_current_room');
  }

  for (const change of changes) {
    assertSameRoom(currentSnapshot, change.before);
    assertSameRoom(currentSnapshot, change.after);
    if (change.before.role !== change.after.role) {
      throw new DocumentRoomIntentError('role_mismatch');
    }
  }
  if (changes.length === 0) {
    return;
  }

  const currentStateVector = Y.encodeStateVector(current);
  const staged = new Y.Doc();
  try {
    Y.applyUpdate(staged, Y.encodeStateAsUpdate(current));
    for (const change of changes) {
      const stagedSnapshot = captureDocumentRoomSnapshot(documentName, staged);
      if (!stagedSnapshot) {
        throw new DocumentRoomIntentError('invalid_current_room');
      }
      assertSameRoom(stagedSnapshot, change.before);
      assertSameRoom(stagedSnapshot, change.after);
      if (stagedSnapshot.role !== change.before.role || change.before.role !== change.after.role) {
        throw new DocumentRoomIntentError('role_mismatch');
      }

      staged.transact(() => applyChange(staged, change.before, change.after), 'document-room-intent-replay');
      if (!captureDocumentRoomSnapshot(documentName, staged)) {
        throw new DocumentRoomIntentError('invalid_current_room');
      }
    }

    const update = Y.encodeStateAsUpdate(staged, currentStateVector);
    if (update.byteLength > 0) {
      Y.applyUpdate(current, update, origin);
    }
  } finally {
    staged.destroy();
  }
}

function assertSameRoom(current: DocumentRoomIntentSnapshot, expected: DocumentRoomIntentSnapshot): void {
  if (current.documentType !== expected.documentType) {
    throw new DocumentRoomIntentError('document_type_mismatch');
  }
  if (current.documentName !== expected.documentName) {
    throw new DocumentRoomIntentError('document_identity_mismatch');
  }
  if (current.sourceLocale !== expected.sourceLocale) {
    throw new DocumentRoomIntentError('source_locale_mismatch');
  }
  if (current.locale !== expected.locale) {
    throw new DocumentRoomIntentError('locale_mismatch');
  }
}

function applyChange(document: Y.Doc, before: DocumentRoomIntentSnapshot, after: DocumentRoomIntentSnapshot): void {
  if (before.documentType !== after.documentType) {
    throw new DocumentRoomIntentError('document_type_mismatch');
  }
  if (before.role !== after.role) {
    throw new DocumentRoomIntentError('role_mismatch');
  }

  switch (before.documentType) {
    case 'menu': {
      if (after.documentType !== 'menu') {
        throw new DocumentRoomIntentError('document_type_mismatch');
      }
      if (before.role === 'source') {
        if (before.name !== after.name || !sameJson(before.items, after.items)) {
          replaceMenuCanonicalSource(document, after.name, after.items, {
            name: before.name,
            items: before.items,
          });
        }
      } else {
        applyMenuTargetLabels(document, before, after);
      }
      return;
    }
    case 'post_series':
      if (after.documentType !== 'post_series') {
        throw new DocumentRoomIntentError('document_type_mismatch');
      }
      applyPostSeriesFields(document, before.fields, after.fields);
      return;
    case 'email_layout':
      if (before.role === 'source' && after.documentType === 'email_layout' && after.role === 'source') {
        if (before.contentHtml !== after.contentHtml) {
          const html = document.getText(EMAIL_LAYOUT_HTML_TEXT_NAME);
          if (html.length > 0) {
            html.delete(0, html.length);
          }
          if (after.contentHtml.length > 0) {
            html.insert(0, after.contentHtml);
          }
        }
      } else if (before.role === 'target' && after.documentType === 'email_layout' && after.role === 'target') {
        applyEmailLayoutTargetValues(document, before, after);
      } else {
        throw new DocumentRoomIntentError('role_mismatch');
      }
  }
}

function applyMenuTargetLabels(
  document: Y.Doc,
  before: MenuDocumentRoomIntentSnapshot,
  after: MenuDocumentRoomIntentSnapshot,
): void {
  const items = document.getMap<string>(MENU_ITEMS_MAP_NAME);
  const keys = new Set([...Object.keys(before.requestedLabels), ...Object.keys(after.requestedLabels)]);
  for (const itemId of keys) {
    const hadBefore = Object.hasOwn(before.requestedLabels, itemId);
    const hasAfter = Object.hasOwn(after.requestedLabels, itemId);
    if (hadBefore === hasAfter && (!hadBefore || before.requestedLabels[itemId] === after.requestedLabels[itemId])) {
      continue;
    }
    // A concurrent source edit can delete the item. Do not recreate its label or item.
    if (!items.has(itemId)) {
      continue;
    }
    if (hasAfter) {
      setMenuLocaleLabel(document, itemId, after.requestedLabels[itemId]!);
    } else {
      unsetMenuLocaleLabel(document, itemId);
    }
  }
  extractMenuCanonicalSnapshot(document);
}

function applyPostSeriesFields(
  document: Y.Doc,
  before: PostSeriesStoredLocaleFields,
  after: PostSeriesStoredLocaleFields,
): void {
  for (const field of ['title', 'summary'] as const) {
    const hadBefore = Object.hasOwn(before, field);
    const hasAfter = Object.hasOwn(after, field);
    if (hadBefore === hasAfter && (!hadBefore || before[field] === after[field])) {
      continue;
    }
    if (hasAfter) {
      setPostSeriesLocaleField(document, field, after[field]!);
    } else {
      unsetPostSeriesLocaleField(document, field);
    }
  }
  materializePostSeriesLocaleFields(document);
}

function applyEmailLayoutTargetValues(
  document: Y.Doc,
  before: EmailLayoutTargetDocumentRoomIntentSnapshot,
  after: EmailLayoutTargetDocumentRoomIntentSnapshot,
): void {
  const currentHandles = new Set(
    document
      .getArray<EmailLayoutUnit>(EMAIL_LAYOUT_UNITS_ARRAY_NAME)
      .toArray()
      .map(({ handle }) => handle),
  );
  const handles = new Set([...Object.keys(before.localeValues), ...Object.keys(after.localeValues)]);
  for (const handle of handles) {
    const hadBefore = Object.hasOwn(before.localeValues, handle);
    const hasAfter = Object.hasOwn(after.localeValues, handle);
    if (hadBefore === hasAfter && (!hadBefore || before.localeValues[handle] === after.localeValues[handle])) {
      continue;
    }
    // Source HTML can remove a translated unit while a target editor is offline.
    if (!currentHandles.has(handle)) {
      continue;
    }
    if (hasAfter) {
      setEmailLayoutLocaleValue(document, handle, after.localeValues[handle]!);
    } else {
      unsetEmailLayoutLocaleValue(document, handle);
    }
  }
  extractEmailLayoutLocaleValues(document);
  materializeEmailLayoutUnits(document);
}

function toEmailLayoutUnit(unit: ReturnType<typeof materializeEmailLayoutUnits>[number]): EmailLayoutUnit {
  const { value: _value, localeValuePresent: _localeValuePresent, ...stored } = unit;
  return stored;
}

function sameJson(left: unknown, right: unknown): boolean {
  return stableJson(left) === stableJson(right);
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(',')}]`;
  }
  if (typeof value === 'object' && value !== null) {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .filter((key) => record[key] !== undefined)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
