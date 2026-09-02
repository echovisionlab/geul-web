import { fromJson } from '@bufbuild/protobuf';
import { contentBlockCatalogFingerprint, richTextBlockKinds } from '@echovisionlab/geul-proto/content/block_catalog.ts';
import {
  LocalizedRichTextDocumentSchema,
  RichTextBlockDataSchema,
  RichTextBlockLocaleDataSchema,
  RichTextProfile,
  type LocalizedRichTextDocument,
  type RichTextBlockData,
  type RichTextBlockLocaleData,
} from '@echovisionlab/geul-proto/content/block_content_pb.ts';
import {
  hydrateCanonicalBlockRoom,
  materializeCanonicalBlockRoom,
} from '@echovisionlab/geul-common/collaboration/block-room-codec';
import { describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';
import { createBlockRoomProseMirrorBridge } from './block-room-prosemirror-bridge';
import { richTextProseMirrorAdapterForProtoCase, richTextProseMirrorAdapters } from './block-room-prosemirror-registry';

const BLOCK_ID = '019cce25-dbc0-7d12-9f1f-735b1a6c6b13';
const INSERTED_ID = '019cce25-dbc0-7d12-9f1f-735b1a6c6b14';

function paragraphData(): RichTextBlockData {
  return fromJson(RichTextBlockDataSchema, {
    paragraph: { props: {} },
  }) as RichTextBlockData;
}

function paragraphLocale(text: string): RichTextBlockLocaleData {
  return fromJson(RichTextBlockLocaleDataSchema, {
    paragraph: {
      props: {},
      content: [{ text: { text } }],
    },
  }) as RichTextBlockLocaleData;
}

function document(locale = 'ko', text = '안녕'): LocalizedRichTextDocument {
  return fromJson(LocalizedRichTextDocumentSchema, {
    blockCatalogFingerprint: contentBlockCatalogFingerprint,
    profile: RichTextProfile.POST,
    locale,
    base: {
      nodes: [
        {
          block: {
            id: BLOCK_ID,
            paragraph: { props: { backgroundColor: 'default' } },
          },
          placement: { index: 0 },
        },
      ],
    },
    localeOverlay: {
      locale,
      blocks: [
        {
          blockId: BLOCK_ID,
          paragraph: {
            props: {},
            content: [{ text: { text } }],
          },
        },
      ],
    },
  }) as LocalizedRichTextDocument;
}

function bridge({
  locale = 'ko',
  text = '안녕',
  createId = vi.fn(() => INSERTED_ID),
}: {
  locale?: string;
  text?: string;
  createId?: () => string;
} = {}) {
  const room = new Y.Doc();
  hydrateCanonicalBlockRoom(room, 'post', 'ko', document(locale, text), []);
  return {
    room,
    bridge: createBlockRoomProseMirrorBridge({
      document: room,
      documentType: 'post',
      locale,
      createId,
      origin: 'pm-bridge-test',
    }),
  };
}

describe('rich-text ProseMirror adapter registry', () => {
  it('exhaustively registers every generated kind', () => {
    expect(Object.keys(richTextProseMirrorAdapters)).toEqual(richTextBlockKinds);
    expect(richTextProseMirrorAdapters['code-block']).toMatchObject({
      protoCase: 'codeBlock',
      nodeType: 'codeBlock',
      contentShape: 'plain-text',
    });
    expect(() => richTextProseMirrorAdapterForProtoCase('futureBlock')).toThrow(
      'Unsupported generated rich-text Block proto case',
    );
  });
});

describe('BlockRoomProseMirrorBridge', () => {
  it('projects ordered localized Blocks without exposing the room root', () => {
    const { bridge: subject } = bridge();

    expect(subject.readBlocks()).toEqual([
      expect.objectContaining({
        id: BLOCK_ID,
        adapter: expect.objectContaining({ kind: 'paragraph', nodeType: 'paragraph' }),
        basePayload: expect.objectContaining({ props: expect.any(Object) }),
        localePayload: expect.objectContaining({ content: expect.any(Array) }),
        children: [],
      }),
    ]);
  });

  it('routes ordinary text and atomic edits through narrow codec operations', () => {
    const { room, bridge: subject } = bridge();

    subject.replaceCollaborativeText({
      blockId: BLOCK_ID,
      scope: 'locale',
      path: 'content[0].text.text',
      from: 1,
      to: 2,
      insert: '녕하세요',
    });
    subject.setAtomicValue({ blockId: BLOCK_ID, scope: 'base', path: 'props.backgroundColor' }, '#ffffff');

    expect(subject.getAtomicValue({ blockId: BLOCK_ID, scope: 'base', path: 'props.backgroundColor' })).toBe('#ffffff');
    const materialized = materializeCanonicalBlockRoom(room, 'post');
    if (materialized.$typeName !== 'api.content.v1.LocalizedRichTextDocument') {
      throw new Error('Expected localized rich-text document.');
    }
    expect(materialized.localeOverlay?.blocks[0]?.value.value).toMatchObject({
      content: [{ value: { value: { text: '안녕하세요' } } }],
    });
  });

  it('uses a relative anchor and UUID factory for structural insertion', () => {
    const createId = vi.fn(() => INSERTED_ID);
    const { room, bridge: subject } = bridge({ createId });
    const anchor = subject.createInsertionAnchor({ index: 1 });

    expect(
      subject.insertBlock({
        data: paragraphData(),
        localeData: { ko: paragraphLocale('둘째') },
        index: 1,
        anchor,
      }),
    ).toBe(INSERTED_ID);
    expect(createId).toHaveBeenCalledOnce();
    expect(subject.readBlocks().map((block) => block.id)).toEqual([BLOCK_ID, INSERTED_ID]);
    expect(() => materializeCanonicalBlockRoom(room, 'post')).not.toThrow();
  });

  it('applies collection edits and an explicit atomic kind replacement', () => {
    const { room, bridge: subject } = bridge();
    const content = { blockId: BLOCK_ID, scope: 'locale', path: 'content' } as const;
    subject.insertCollectionItem(content, 1, { hardBreak: {} });
    subject.moveCollectionItem(content, 1, 0);
    subject.deleteCollectionItem(content, 0);

    const heading = fromJson(RichTextBlockDataSchema, {
      heading: { props: { level: 2 } },
    }) as RichTextBlockData;
    const ko = fromJson(RichTextBlockLocaleDataSchema, {
      heading: { props: {}, content: [{ text: { text: '제목' } }] },
    }) as RichTextBlockLocaleData;
    subject.replaceBlockKind({
      blockId: BLOCK_ID,
      expectedKind: 'paragraph',
      data: heading,
      localeData: { ko },
    });

    expect(subject.readBlocks()[0]?.adapter.kind).toBe('heading');
    expect(() => materializeCanonicalBlockRoom(room, 'post')).not.toThrow();
  });

  it('fails before mutation when a target payload is supplied beside the source', () => {
    const { room, bridge: subject } = bridge();
    const before = Y.encodeStateVector(room);

    expect(() =>
      subject.insertBlock({
        data: paragraphData(),
        localeData: { ko: paragraphLocale('둘째'), en: paragraphLocale('Second') },
        index: 1,
      }),
    ).toThrow('locale set');
    expect(Y.encodeStateVector(room)).toEqual(before);
  });

  it('full-decodes and reconnects the exact source locale without retaining another locale', () => {
    const { room, bridge: subject } = bridge({ locale: 'ko', text: '원문' });

    subject.replaceCollaborativeTextValue(
      { blockId: BLOCK_ID, scope: 'locale', path: 'content[0].text.text' },
      '수정된 원문',
    );
    const reconnected = createBlockRoomProseMirrorBridge({
      document: room,
      documentType: 'post',
      locale: 'ko',
    });

    expect(reconnected.locales).toEqual(['ko']);
    expect(reconnected.readLocalizedRichTextDocument().locale).toBe('ko');
    expect(reconnected.readBlocks()[0]?.localePayload).toMatchObject({
      content: [expect.objectContaining({ text: expect.objectContaining({ text: '수정된 원문' }) })],
    });
  });

  it('full-decodes and reconnects an exact target without leaking source-locale units', () => {
    const { room, bridge: subject } = bridge({ locale: 'en', text: 'Hello' });
    const observed = vi.fn();
    const unsubscribe = subject.observe(observed);

    expect(subject.readBlocks()[0]?.localePayload).toMatchObject({
      content: [expect.objectContaining({ text: expect.objectContaining({ text: 'Hello' }) })],
    });
    subject.replaceCollaborativeText({
      blockId: BLOCK_ID,
      scope: 'locale',
      path: 'content[0].text.text',
      from: 0,
      to: 5,
      insert: 'Updated',
    });
    expect(observed).toHaveBeenCalledWith([
      expect.objectContaining({
        id: BLOCK_ID,
        localePayload: expect.objectContaining({
          content: [expect.objectContaining({ text: expect.objectContaining({ text: 'Updated' }) })],
        }),
      }),
    ]);
    unsubscribe();

    const reconnected = createBlockRoomProseMirrorBridge({
      document: room,
      documentType: 'post',
      locale: 'en',
    });
    expect(reconnected.locales).toEqual(['en']);
    expect(reconnected.readLocalizedRichTextDocument().locale).toBe('en');
    expect(reconnected.readBlocks()[0]?.localePayload).toMatchObject({
      content: [expect.objectContaining({ text: expect.objectContaining({ text: 'Updated' }) })],
    });
  });

  it('keeps target locale text writable but rejects base and structural mutations', () => {
    const { room, bridge: subject } = bridge({ locale: 'en', text: 'Hello' });
    const before = materializeCanonicalBlockRoom(room, 'post');

    expect(() =>
      subject.setAtomicValue({ blockId: BLOCK_ID, scope: 'base', path: 'props.backgroundColor' }, '#ffffff'),
    ).toThrow('cannot mutate shared rich-text structure');
    expect(() => subject.deleteBlock(BLOCK_ID)).toThrow('cannot mutate shared rich-text structure');
    expect(() =>
      subject.insertBlock({
        data: paragraphData(),
        localeData: { en: paragraphLocale('Second') },
        index: 1,
      }),
    ).toThrow('cannot mutate shared rich-text structure');

    subject.replaceCollaborativeTextValue(
      { blockId: BLOCK_ID, scope: 'locale', path: 'content[0].text.text' },
      'Target only',
    );
    const after = materializeCanonicalBlockRoom(room, 'post');
    if (
      before.$typeName !== 'api.content.v1.LocalizedRichTextDocument' ||
      after.$typeName !== 'api.content.v1.LocalizedRichTextDocument'
    ) {
      throw new Error('Expected localized rich-text documents.');
    }
    expect(after.base).toEqual(before.base);
    expect(after.localeOverlay?.blocks[0]?.value.value).toMatchObject({
      content: [{ value: { value: { text: 'Target only' } } }],
    });
  });

  it('rejects a bridge locale that differs from the authenticated room', () => {
    const room = new Y.Doc();
    hydrateCanonicalBlockRoom(room, 'post', 'ko', document('en', 'Hello'), []);

    expect(() => createBlockRoomProseMirrorBridge({ document: room, documentType: 'post', locale: 'ko' })).toThrow(
      'locale does not match',
    );
  });
});
