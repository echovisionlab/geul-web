import * as Y from 'yjs';
import { CollaborativeDocumentType, createDocumentName } from '@echovisionlab/geul-common/collaboration/document';
import { describe, expect, it } from 'vitest';
import {
  getDocumentRoomSnapshot,
  DOCUMENT_ROOM_SNAPSHOT_KEYS,
  DOCUMENT_ROOM_SNAPSHOT_MAP_NAME,
} from './document-room-snapshot';

const ENTITY_ID = '11111111-1111-4111-8111-111111111111';
const DOCUMENT_REVISION = '22222222-2222-4222-8222-222222222222';
const TARGET_REVISION = '33333333-3333-4333-8333-333333333333';

function roomDocument(documentName: string, overrides: Record<string, string | boolean> = {}): Y.Doc {
  const document = new Y.Doc();
  document
    .getMap<string | boolean>(DOCUMENT_ROOM_SNAPSHOT_MAP_NAME)
    .set(DOCUMENT_ROOM_SNAPSHOT_KEYS.documentName, documentName);
  document
    .getMap<string | boolean>(DOCUMENT_ROOM_SNAPSHOT_MAP_NAME)
    .set(DOCUMENT_ROOM_SNAPSHOT_KEYS.documentRevision, DOCUMENT_REVISION);
  document
    .getMap<string | boolean>(DOCUMENT_ROOM_SNAPSHOT_MAP_NAME)
    .set(DOCUMENT_ROOM_SNAPSHOT_KEYS.sourceLocale, 'en');
  document.getMap<string | boolean>(DOCUMENT_ROOM_SNAPSHOT_MAP_NAME).set(DOCUMENT_ROOM_SNAPSHOT_KEYS.locale, 'en');
  document
    .getMap<string | boolean>(DOCUMENT_ROOM_SNAPSHOT_MAP_NAME)
    .set(DOCUMENT_ROOM_SNAPSHOT_KEYS.localeExists, true);
  for (const [key, value] of Object.entries(overrides)) {
    document.getMap<string | boolean>(DOCUMENT_ROOM_SNAPSHOT_MAP_NAME).set(key, value);
  }
  return document;
}

describe('getDocumentRoomSnapshot', () => {
  it.each([
    ['form', CollaborativeDocumentType.FORM],
    ['menu', CollaborativeDocumentType.MENU],
    ['email_layout', CollaborativeDocumentType.EMAIL_LAYOUT],
    ['post_series', CollaborativeDocumentType.POST_SERIES],
  ] as const)('accepts the server snapshot for %s', (entityType, documentType) => {
    const documentName = createDocumentName(documentType, ENTITY_ID, 'en');

    expect(
      getDocumentRoomSnapshot(roomDocument(documentName), {
        entityType,
        entityId: ENTITY_ID,
        documentName,
      }),
    ).toEqual({
      documentName,
      documentRevision: DOCUMENT_REVISION,
      sourceLocale: 'en',
      locale: 'en',
      localeExists: true,
    });
  });

  it('accepts an existing target revision and preserves its observed baseline', () => {
    const documentName = createDocumentName(CollaborativeDocumentType.MENU, ENTITY_ID, 'ko');
    const document = roomDocument(documentName, {
      [DOCUMENT_ROOM_SNAPSHOT_KEYS.locale]: 'ko',
      [DOCUMENT_ROOM_SNAPSHOT_KEYS.localeExists]: true,
      [DOCUMENT_ROOM_SNAPSHOT_KEYS.targetRevision]: TARGET_REVISION,
    });

    expect(getDocumentRoomSnapshot(document, { entityType: 'menu', entityId: ENTITY_ID, documentName })).toEqual({
      documentName,
      documentRevision: DOCUMENT_REVISION,
      sourceLocale: 'en',
      locale: 'ko',
      localeExists: true,
      targetRevision: TARGET_REVISION,
    });
  });

  it('preserves an optional revision reported for a missing Menu or Post Series target', () => {
    for (const [entityType, documentType] of [
      ['menu', CollaborativeDocumentType.MENU],
      ['post_series', CollaborativeDocumentType.POST_SERIES],
    ] as const) {
      const documentName = createDocumentName(documentType, ENTITY_ID, 'ko');
      const document = roomDocument(documentName, {
        [DOCUMENT_ROOM_SNAPSHOT_KEYS.locale]: 'ko',
        [DOCUMENT_ROOM_SNAPSHOT_KEYS.localeExists]: false,
        [DOCUMENT_ROOM_SNAPSHOT_KEYS.targetRevision]: TARGET_REVISION,
      });

      expect(getDocumentRoomSnapshot(document, { entityType, entityId: ENTITY_ID, documentName })).toEqual({
        documentName,
        documentRevision: DOCUMENT_REVISION,
        sourceLocale: 'en',
        locale: 'ko',
        localeExists: false,
        targetRevision: TARGET_REVISION,
      });
    }
  });

  it('rejects missing, mismatched, or malformed observed baselines', () => {
    const documentName = createDocumentName(CollaborativeDocumentType.POST_SERIES, ENTITY_ID, 'en');
    const valid = roomDocument(documentName);

    expect(getDocumentRoomSnapshot(null, { entityType: 'post_series', entityId: ENTITY_ID })).toBeNull();
    expect(getDocumentRoomSnapshot(valid, { entityType: 'menu', entityId: ENTITY_ID })).toBeNull();
    expect(getDocumentRoomSnapshot(valid, { entityType: 'series', entityId: ENTITY_ID })).toBeNull();
    expect(
      getDocumentRoomSnapshot(valid, { entityType: 'post_series', entityId: '44444444-4444-4444-8444-444444444444' }),
    ).toBeNull();
    expect(
      getDocumentRoomSnapshot(valid, {
        entityType: 'post_series',
        entityId: ENTITY_ID,
        documentName: 'post-series:other:en',
      }),
    ).toBeNull();
    expect(
      getDocumentRoomSnapshot(
        roomDocument(documentName, { [DOCUMENT_ROOM_SNAPSHOT_KEYS.documentRevision]: 'not-a-revision' }),
        { entityType: 'post_series', entityId: ENTITY_ID },
      ),
    ).toBeNull();
    expect(
      getDocumentRoomSnapshot(roomDocument(documentName, { [DOCUMENT_ROOM_SNAPSHOT_KEYS.localeExists]: false }), {
        entityType: 'post_series',
        entityId: ENTITY_ID,
      }),
    ).toBeNull();
  });
});
