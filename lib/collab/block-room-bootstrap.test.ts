import { create, toJson } from '@bufbuild/protobuf';
import {
  LocalizedRichTextDocumentSchema,
  RichTextProfile,
  type LocalizedRichTextDocument,
} from '@echovisionlab/geul-proto/content/block_content_pb.ts';
import { contentBlockCatalogFingerprint } from '@echovisionlab/geul-proto/content/block_catalog.ts';
import { hydrateCanonicalBlockRoom } from '@echovisionlab/geul-common/collaboration/block-room-codec';
import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import { applyBlockRoomBootstrap, parseBlockRoomBootstrap } from './block-room-bootstrap';

const fingerprint = contentBlockCatalogFingerprint;
const entityId = '01b3db42-75f1-4bf1-8cb9-9b3baf57e795';

function typedDocument(locale = 'en'): LocalizedRichTextDocument {
  return create(LocalizedRichTextDocumentSchema, {
    blockCatalogFingerprint: fingerprint,
    profile: RichTextProfile.POST,
    locale,
    base: { nodes: [] },
    localeOverlay: { locale, blocks: [] },
  });
}

function bootstrapMessage(
  document = typedDocument(),
  updateDocument = document,
  options: { sourceLocale?: string; roomLocale?: string; localeExists?: boolean; targetRevision?: string } = {},
) {
  const roomLocale = options.roomLocale ?? document.locale;
  const sourceLocale = options.sourceLocale ?? roomLocale;
  const localeExists = options.localeExists ?? true;
  const yDocument = new Y.Doc();
  hydrateCanonicalBlockRoom(yDocument, 'post', sourceLocale, updateDocument, []);
  const update = Buffer.from(Y.encodeStateAsUpdate(yDocument)).toString('base64');
  yDocument.destroy();
  const sourceMetadata = {
    locale: sourceLocale,
    title: 'Canonical source title',
    summary: 'Canonical source summary',
  };
  return {
    kind: 'block_room.bootstrap',
    protocolVersion: 1,
    bootstrapChallenge: 'challenge-1',
    documentName: `post:${entityId}:${roomLocale}`,
    documentType: 'post',
    document: toJson(LocalizedRichTextDocumentSchema, document),
    documentRevision: 'b67328c4-668c-5bf2-8f1e-41465149ded6',
    sourceLocale,
    locale: roomLocale,
    localeExists,
    presentLocaleValues: [],
    targetRevision: options.targetRevision,
    sourceMetadata,
    localeMetadata: localeExists ? (roomLocale === sourceLocale ? sourceMetadata : { locale: roomLocale }) : undefined,
    blockCatalogFingerprint: fingerprint,
    serverInstanceId: 'collab-1',
    roomEpoch: 'bdac72af-8a24-4214-999d-83727445cbd7',
    yjsBootstrapUpdate: update,
  };
}

describe('block-room WebSocket bootstrap', () => {
  it('decodes and semantically validates the typed document against its Yjs update', () => {
    const bootstrap = parseBlockRoomBootstrap(bootstrapMessage(), 'post', entityId, 'en');
    const hydrated = applyBlockRoomBootstrap(bootstrap);

    expect(bootstrap.bootstrapChallenge).toBe('challenge-1');
    expect(bootstrap.sourceLocale).toBe('en');
    expect(bootstrap.locale).toBe('en');
    expect(bootstrap.sourceMetadata).toEqual({
      locale: 'en',
      title: 'Canonical source title',
      summary: 'Canonical source summary',
    });
    expect(hydrated.getMap('block-document').get('documentType')).toBe('post');
    hydrated.destroy();
  });

  it('preserves a server-issued target revision byte-for-byte and rejects a blank token', () => {
    const targetRevision = `tr1_${'A'.repeat(43)}`;
    const targetMessage = bootstrapMessage(typedDocument('en'), undefined, {
      sourceLocale: 'ko',
      roomLocale: 'en',
      targetRevision,
    });
    expect(parseBlockRoomBootstrap(targetMessage, 'post', entityId, 'en').targetRevision).toBe(targetRevision);

    const opaqueTargetRevision = ` ${targetRevision}\n`;
    expect(
      parseBlockRoomBootstrap({ ...targetMessage, targetRevision: opaqueTargetRevision }, 'post', entityId, 'en')
        .targetRevision,
    ).toBe(opaqueTargetRevision);
    expect(() => parseBlockRoomBootstrap({ ...targetMessage, targetRevision: '  ' }, 'post', entityId, 'en')).toThrow(
      /failed validation/u,
    );
  });

  it('fails closed when source, room, presence, and target-token authority disagree', () => {
    const sourceMessage = bootstrapMessage();
    expect(() =>
      parseBlockRoomBootstrap({ ...sourceMessage, sourceMetadata: undefined }, 'post', entityId, 'en'),
    ).toThrow(/failed validation/u);
    expect(() =>
      parseBlockRoomBootstrap({ ...sourceMessage, localeMetadata: undefined }, 'post', entityId, 'en'),
    ).toThrow(/locale authority mismatch/u);
    expect(() =>
      parseBlockRoomBootstrap(
        { ...sourceMessage, localeMetadata: { ...sourceMessage.localeMetadata, title: 'different' } },
        'post',
        entityId,
        'en',
      ),
    ).toThrow(/locale authority mismatch/u);
    expect(() =>
      parseBlockRoomBootstrap({ ...bootstrapMessage(), sourceLocale: 'ko' }, 'post', entityId, 'en'),
    ).toThrow(/source locale metadata mismatch/u);
    expect(() => parseBlockRoomBootstrap({ ...bootstrapMessage(), locale: 'ja' }, 'post', entityId, 'en')).toThrow(
      /different document/u,
    );
    expect(() =>
      parseBlockRoomBootstrap(
        bootstrapMessage(typedDocument('en'), undefined, {
          sourceLocale: 'ko',
          roomLocale: 'en',
          localeExists: true,
        }),
        'post',
        entityId,
        'en',
      ),
    ).toThrow(/locale authority mismatch/u);

    const presenceMismatch = parseBlockRoomBootstrap(
      {
        ...sourceMessage,
        presentLocaleValues: [
          {
            blockHandle: '8f673049-6533-43cf-8ba9-78801dd3e394',
            fieldHandle: 'content',
          },
        ],
      },
      'post',
      entityId,
      'en',
    );
    expect(() => applyBlockRoomBootstrap(presenceMismatch)).toThrow(/do not match/u);
  });

  it('fails closed on another target, catalog, or typed/Yjs semantic value', () => {
    expect(() => parseBlockRoomBootstrap(bootstrapMessage(), 'work', entityId, 'en')).toThrow(/different document/u);
    expect(() =>
      parseBlockRoomBootstrap(
        {
          ...bootstrapMessage(),
          blockCatalogFingerprint: 'different',
        },
        'post',
        entityId,
        'en',
      ),
    ).toThrow(/fingerprint mismatch/u);

    const bootstrap = parseBlockRoomBootstrap(
      bootstrapMessage(typedDocument('en'), typedDocument('ko')),
      'post',
      entityId,
      'en',
    );
    expect(() => applyBlockRoomBootstrap(bootstrap)).toThrow(/do not match/u);
  });
});
