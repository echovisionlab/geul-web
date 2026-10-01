import { fromJson, type JsonValue } from '@bufbuild/protobuf';
import { contentBlockCatalogFingerprint, pageSectionKinds } from '@echovisionlab/geul-proto/content/block_catalog.ts';
import {
  LocalizedPageDocumentSchema,
  RichTextBlockDataSchema,
  RichTextBlockLocaleDataSchema,
  type RichTextBlockData,
  type RichTextBlockLocaleData,
} from '@echovisionlab/geul-proto/content/block_content_pb.ts';
import {
  getBlockRoomCollaborativeText,
  hydrateCanonicalBlockRoom,
  materializeCanonicalBlockRoom,
} from '@echovisionlab/geul-common/collaboration/block-room-codec';
import { describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';
import { createDefaultSection } from './types';
import { parseSectionMeta } from '@/features/page/blocks/section-schema';
import { createBlockRoomProseMirrorBridge } from '@/features/editor/tiptap/block-room-prosemirror-bridge';
import { createBlockRoomPageSectionsController } from './block-room-page-sections';
import { parseImmersiveSceneConfig } from '@/features/page/blocks/immersive-scene/schema';
import { immersiveSceneUnitMutationProps } from '@/features/page/blocks/immersive-scene/settings-model';

const FORM_ID = '019cce25-dbc0-7d12-9f1f-735b1a6c6b13';
const SECTION_ID = '019cce25-dbc0-7d12-9f1f-735b1a6c6b14';
const AUTHOR_ID_1 = '019cce25-dbc0-7d12-9f1f-735b1a6c6b15';
const AUTHOR_ID_2 = '019cce25-dbc0-7d12-9f1f-735b1a6c6b16';

function paragraphData(): RichTextBlockData {
  return fromJson(RichTextBlockDataSchema, { paragraph: { props: {} } }) as RichTextBlockData;
}

function paragraphLocale(text: string): RichTextBlockLocaleData {
  return fromJson(RichTextBlockLocaleDataSchema, {
    paragraph: { props: {}, content: [{ text: { text } }] },
  }) as RichTextBlockLocaleData;
}

function room(locale = 'ko', sourceLocale = 'ko'): Y.Doc {
  const document = new Y.Doc();
  hydrateCanonicalBlockRoom(
    document,
    'page',
    sourceLocale,
    fromJson(LocalizedPageDocumentSchema, {
      blockCatalogFingerprint: contentBlockCatalogFingerprint,
      locale,
      base: { nodes: [] },
      localeOverlay: { locale, sections: [] },
    } as JsonValue),
    [],
  );
  return document;
}

function targetRoom(): Y.Doc {
  const document = new Y.Doc();
  hydrateCanonicalBlockRoom(
    document,
    'page',
    'ko',
    fromJson(LocalizedPageDocumentSchema, {
      blockCatalogFingerprint: contentBlockCatalogFingerprint,
      locale: 'en',
      base: {
        nodes: [
          {
            section: {
              id: SECTION_ID,
              externalVideo: { props: { uri: 'https://example.com/video' } },
            },
            placement: { index: 0 },
          },
        ],
      },
      localeOverlay: {
        locale: 'en',
        sections: [
          {
            sectionId: SECTION_ID,
            externalVideo: { props: { caption: 'Description' } },
          },
        ],
      },
    } as JsonValue),
    [],
  );
  return document;
}

describe('typed Page Block-room section controller', () => {
  it('does not notify the Page section projection for rich-text body edits', () => {
    const document = room();
    const controller = createBlockRoomPageSectionsController(document, 'ko');
    const section = createDefaultSection('rich-text');
    controller.insert(section, { index: 0 });
    const pageChanges = vi.fn();
    const stopPage = controller.observe(pageChanges);
    const bridge = createBlockRoomProseMirrorBridge({
      document,
      documentType: 'page',
      locale: 'ko',
      pageSectionId: section.id,
    });
    const editorChanges = vi.fn();
    const stopEditor = bridge.observe(editorChanges);
    const blockId = bridge.insertBlock({
      data: paragraphData(),
      localeData: { ko: paragraphLocale('처음') },
      index: 1,
    });
    pageChanges.mockClear();
    editorChanges.mockClear();

    const text = getBlockRoomCollaborativeText(document, {
      id: blockId,
      family: 'rich_text',
      locale: true,
      path: 'content[0].text.text',
    });
    text.insert(text.length, '됨');

    expect(pageChanges).not.toHaveBeenCalled();
    expect(editorChanges).toHaveBeenCalledOnce();
    expect(bridge.readBlocks().find((block) => block.id === blockId)?.localePayload).toMatchObject({
      content: [{ text: { text: '처음됨' } }],
    });
    stopEditor();
    stopPage();
    document.destroy();
  });

  it('routes block and section deletions to every bridge observer, including fresh subscriptions', () => {
    const document = room();
    const controller = createBlockRoomPageSectionsController(document, 'ko');
    const section = createDefaultSection('rich-text');
    controller.insert(section, { index: 0 });
    const bridge = createBlockRoomProseMirrorBridge({
      document,
      documentType: 'page',
      locale: 'ko',
      pageSectionId: section.id,
    });
    const firstChanges = vi.fn();
    const secondChanges = vi.fn();
    const stopFirst = bridge.observe(firstChanges);
    const stopSecond = bridge.observe(secondChanges);
    const insertBlock = (): string =>
      bridge.insertBlock({
        data: paragraphData(),
        localeData: { ko: paragraphLocale('텍스트') },
        index: bridge.readBlocks().length,
      });

    const firstBlockId = insertBlock();
    expect(firstChanges).toHaveBeenCalledOnce();
    expect(secondChanges).toHaveBeenCalledOnce();
    firstChanges.mockClear();
    secondChanges.mockClear();
    bridge.deleteBlock(firstBlockId);
    expect(firstChanges).toHaveBeenCalledOnce();
    expect(secondChanges).toHaveBeenCalledOnce();

    stopFirst();
    stopSecond();
    const unobservedBlockId = insertBlock();
    const freshChanges = vi.fn();
    const stopFresh = bridge.observe(freshChanges);
    bridge.deleteBlock(unobservedBlockId);
    expect(freshChanges).toHaveBeenCalledOnce();
    stopFresh();

    const laterFirst = vi.fn();
    const laterSecond = vi.fn();
    const stopLaterFirst = bridge.observe(laterFirst);
    const stopLaterSecond = bridge.observe(laterSecond);
    controller.delete(section.id);
    expect(laterFirst).toHaveBeenCalledOnce();
    expect(laterSecond).toHaveBeenCalledOnce();

    stopLaterFirst();
    stopLaterSecond();
    document.destroy();
  });

  it.each(pageSectionKinds)('inserts and reads generated %s sections', (kind) => {
    const document = room();
    const controller = createBlockRoomPageSectionsController(document, 'ko');
    const initial = createDefaultSection(kind);
    const section =
      kind === 'external-video'
        ? parseSectionMeta({ ...initial, props: { ...initial.props, url: 'https://example.com/video' } })
        : kind === 'form'
          ? parseSectionMeta({ ...initial, props: { ...initial.props, formId: FORM_ID } })
          : initial;

    controller.insert(section, { index: 0 });

    expect(controller.read()).toEqual([expect.objectContaining({ id: section.id, type: kind })]);
    expect(() => materializeCanonicalBlockRoom(document, 'page')).not.toThrow();
  });

  it('updates shared, locale, settings, order, and deletion through narrow codec operations', () => {
    const document = room();
    const controller = createBlockRoomPageSectionsController(document, 'ko');
    const first = parseSectionMeta({
      ...createDefaultSection('external-video'),
      props: { url: 'https://example.com/one', caption: '처음', aspectRatio: 'auto' },
    });
    const second = createDefaultSection('rich-text');
    const changes = vi.fn();
    const stop = controller.observe(changes);
    controller.insert(first, { index: 0 });
    controller.insert(second, { index: 1 });
    controller.update(first.id, {
      settings: { maxWidth: 'narrow', paddingTop: '24' },
      props: { url: 'https://example.com/two', aspectRatio: '16:9' },
    });
    controller.updateLocaleProps(first.id, { caption: '바뀜' });
    controller.move(second.id, { index: 0 });

    expect(controller.read()).toEqual([
      expect.objectContaining({ id: second.id }),
      expect.objectContaining({
        id: first.id,
        settings: expect.objectContaining({ maxWidth: 'narrow', paddingTop: '24' }),
        props: expect.objectContaining({ url: 'https://example.com/two', caption: '바뀜', aspectRatio: '16:9' }),
      }),
    ]);
    expect(changes).toHaveBeenCalled();

    controller.delete(first.id);
    expect(controller.read().map((section) => section.id)).toEqual([second.id]);
    stop();
  });

  it('inserts, moves, updates, and deletes nested Columns sections as one typed graph', () => {
    const document = room();
    const controller = createBlockRoomPageSectionsController(document, 'ko');
    const columns = createDefaultSection('columns');
    if (columns.type !== 'columns') {
      throw new Error('Expected Columns section.');
    }
    const nested = parseSectionMeta({
      ...createDefaultSection('external-video'),
      props: { url: 'https://example.com/nested', caption: '처음' },
    });
    controller.insert(
      {
        ...columns,
        columns: [{ ...columns.columns[0]!, sections: [nested] }, columns.columns[1]!],
      },
      { index: 0 },
    );

    controller.update(nested.id, { props: { url: 'https://example.com/updated' } });
    controller.updateLocaleProps(nested.id, { caption: '수정됨' });
    controller.update(columns.id, {
      columns: [columns.columns[0]!, { ...columns.columns[1]!, sections: [nested] }],
    });

    const moved = controller.read()[0];
    expect(moved?.type).toBe('columns');
    if (moved?.type !== 'columns') {
      throw new Error('Expected Columns section.');
    }
    expect(moved.columns[0]?.sections).toEqual([]);
    expect(moved.columns[1]?.sections).toEqual([
      expect.objectContaining({
        id: nested.id,
        props: expect.objectContaining({ url: 'https://example.com/updated', caption: '수정됨' }),
      }),
    ]);

    controller.update(columns.id, { columns: [columns.columns[0]!, columns.columns[1]!] });
    expect(controller.read()[0]).toEqual(
      expect.objectContaining({
        type: 'columns',
        columns: [expect.objectContaining({ sections: [] }), expect.objectContaining({ sections: [] })],
      }),
    );
  });

  it('clears an explicitly emptied optional shared field instead of retaining stale state', () => {
    const document = room();
    const controller = createBlockRoomPageSectionsController(document, 'ko');
    const section = parseSectionMeta({
      ...createDefaultSection('post-list'),
      props: { seriesId: FORM_ID },
    });
    controller.insert(section, { index: 0 });

    controller.update(section.id, { props: { seriesId: '' } });

    const canonical = materializeCanonicalBlockRoom(document, 'page');
    if (canonical.$typeName !== 'api.content.v1.LocalizedPageDocument') {
      throw new Error('Expected localized Page document.');
    }
    const stored = canonical.base?.nodes[0]?.section;
    expect(stored?.value.case).toBe('postList');
    if (stored?.value.case !== 'postList') {
      throw new Error('Expected Post List section.');
    }
    expect(stored.value.value.props?.seriesId).toBeUndefined();
  });

  it('round-trips selected Author IDs in their saved order', () => {
    const document = room();
    const controller = createBlockRoomPageSectionsController(document, 'ko');
    const section = parseSectionMeta({
      ...createDefaultSection('author-list'),
      props: { source: 'selected', authorIds: `${AUTHOR_ID_2},${AUTHOR_ID_1}` },
    });
    controller.insert(section, { index: 0 });

    expect(controller.read()[0]?.props).toEqual(
      expect.objectContaining({ source: 'selected', authorIds: `${AUTHOR_ID_2},${AUTHOR_ID_1}` }),
    );

    const canonical = materializeCanonicalBlockRoom(document, 'page');
    if (canonical.$typeName !== 'api.content.v1.LocalizedPageDocument') {
      throw new Error('Expected localized Page document.');
    }
    const stored = canonical.base?.nodes[0]?.section;
    expect(stored?.value.case).toBe('authorList');
    if (stored?.value.case !== 'authorList') {
      throw new Error('Expected Author List section.');
    }
    expect(stored.value.value.props?.authorIds).toEqual([AUTHOR_ID_2, AUTHOR_ID_1]);
  });

  it('applies stale-render edits as changed-key patches without reverting another field', () => {
    const document = room();
    const controller = createBlockRoomPageSectionsController(document, 'ko');
    const section = parseSectionMeta({
      ...createDefaultSection('external-video'),
      props: { url: 'https://example.com/old', aspectRatio: 'auto' },
    });
    controller.insert(section, { index: 0 });
    const staleProps = { url: 'https://example.com/old', aspectRatio: 'auto' };

    controller.update(section.id, { props: { aspectRatio: '16:9' } });
    controller.update(section.id, { props: { url: 'https://example.com/new' } });

    expect(controller.read()[0]?.props).toMatchObject({
      url: 'https://example.com/new',
      aspectRatio: '16:9',
    });
    expect(staleProps).toEqual({ url: 'https://example.com/old', aspectRatio: 'auto' });
    document.destroy();
  });

  it('merges independent Immersive Scene unit patches by stable unit ID', () => {
    const initial = room();
    const initialController = createBlockRoomPageSectionsController(initial, 'ko');
    const unitIdA = '019cce25-dbc0-7d12-9f1f-735b1a6c6b21';
    const unitIdB = '019cce25-dbc0-7d12-9f1f-735b1a6c6b22';
    const section = parseSectionMeta({
      ...createDefaultSection('immersive-scene'),
      props: {
        unitsJson: JSON.stringify([
          { id: unitIdA, name: 'Opening', mesh: 'sphere', color: '#ffffff' },
          { id: unitIdB, name: 'Ending', mesh: 'cone', color: '#777777' },
        ]),
        copyJson: JSON.stringify([
          { id: unitIdA, title: 'Opening', text: 'Opening copy' },
          { id: unitIdB, title: 'Ending', text: 'Ending copy' },
        ]),
      },
    });
    initialController.insert(section, { index: 0 });
    const baseUpdate = Y.encodeStateAsUpdate(initial);
    const documentA = new Y.Doc();
    const documentB = new Y.Doc();
    Y.applyUpdate(documentA, baseUpdate);
    Y.applyUpdate(documentB, baseUpdate);
    const controllerA = createBlockRoomPageSectionsController(documentA, 'ko');
    const controllerB = createBlockRoomPageSectionsController(documentB, 'ko');
    const vectorA = Y.encodeStateVector(documentA);
    const vectorB = Y.encodeStateVector(documentB);

    controllerA.update(section.id, {
      props: immersiveSceneUnitMutationProps({
        kind: 'patch',
        unitId: unitIdA,
        patch: { name: 'Introduction' },
      }),
    });
    controllerB.update(section.id, {
      props: immersiveSceneUnitMutationProps({
        kind: 'patch',
        unitId: unitIdB,
        patch: {
          color: '#ff0000',
          meshFileId: '019cce25-dbc0-7d12-9f1f-735b1a6c6b23',
        },
      }),
    });
    controllerA.updateLocaleProps(
      section.id,
      immersiveSceneUnitMutationProps({ kind: 'patch', unitId: unitIdA, patch: { title: 'Translated opening' } }),
    );
    controllerB.updateLocaleProps(
      section.id,
      immersiveSceneUnitMutationProps({ kind: 'patch', unitId: unitIdB, patch: { text: 'Translated ending' } }),
    );
    const deltaA = Y.encodeStateAsUpdate(documentA, vectorA);
    const deltaB = Y.encodeStateAsUpdate(documentB, vectorB);
    Y.applyUpdate(documentA, deltaB);
    Y.applyUpdate(documentB, deltaA);

    for (const controller of [controllerA, controllerB]) {
      const scene = controller.read().find((item) => item.id === section.id);
      expect(parseImmersiveSceneConfig(scene?.props).units).toEqual([
        expect.objectContaining({
          id: unitIdA,
          name: 'Introduction',
          color: '#ffffff',
          title: 'Translated opening',
          text: 'Opening copy',
        }),
        expect.objectContaining({
          id: unitIdB,
          name: 'Ending',
          color: '#ff0000',
          meshFileId: '019cce25-dbc0-7d12-9f1f-735b1a6c6b23',
          title: 'Ending',
          text: 'Translated ending',
        }),
      ]);
    }

    documentA.destroy();
    documentB.destroy();
    initial.destroy();
  });

  it('keeps Immersive Scene insert, move, locale edit, and delete as distinct ID-addressed operations', () => {
    const document = room();
    const controller = createBlockRoomPageSectionsController(document, 'ko');
    const unitIdA = '019cce25-dbc0-7d12-9f1f-735b1a6c6b31';
    const unitIdB = '019cce25-dbc0-7d12-9f1f-735b1a6c6b32';
    const unitIdC = '019cce25-dbc0-7d12-9f1f-735b1a6c6b33';
    const section = parseSectionMeta({
      ...createDefaultSection('immersive-scene'),
      props: {
        unitsJson: JSON.stringify([
          { id: unitIdA, name: 'First', mesh: 'sphere', color: '#ffffff' },
          { id: unitIdB, name: 'Second', mesh: 'cone', color: '#777777' },
        ]),
        copyJson: JSON.stringify([
          { id: unitIdA, title: 'First title', text: 'First text' },
          { id: unitIdB, title: 'Second title', text: 'Second text' },
        ]),
      },
    });
    controller.insert(section, { index: 0 });
    const insertedUnit = {
      id: unitIdC,
      name: 'Third',
      mesh: 'sphere' as const,
      color: '#000000',
      title: 'Third title',
      text: 'Third text',
    };

    controller.update(section.id, {
      props: immersiveSceneUnitMutationProps({ kind: 'insert', unit: insertedUnit }),
    });
    controller.update(section.id, {
      props: immersiveSceneUnitMutationProps({ kind: 'move', unitId: unitIdC, direction: -1 }),
    });
    controller.updateLocaleProps(
      section.id,
      immersiveSceneUnitMutationProps({ kind: 'patch', unitId: unitIdC, patch: { title: 'Updated third title' } }),
    );

    let units = parseImmersiveSceneConfig(controller.read()[0]?.props).units;
    expect(units.map((unit) => unit.id)).toEqual([unitIdA, unitIdC, unitIdB]);
    expect(units[1]?.title).toBe('Updated third title');

    controller.update(section.id, {
      props: immersiveSceneUnitMutationProps({ kind: 'remove', unitId: unitIdC }),
    });
    units = parseImmersiveSceneConfig(controller.read()[0]?.props).units;
    expect(units.map((unit) => unit.id)).toEqual([unitIdA, unitIdB]);
    expect(units.map((unit) => unit.title)).toEqual(['First title', 'Second title']);
    document.destroy();
  });

  it('lets a target edit locale leaves while rejecting every shared graph mutation', () => {
    const document = targetRoom();
    const controller = createBlockRoomPageSectionsController(document, 'en');
    const before = materializeCanonicalBlockRoom(document, 'page');
    if (before.$typeName !== 'api.content.v1.LocalizedPageDocument') {
      throw new Error('Expected localized Page document.');
    }
    const baseBefore = before.base;

    expect(() => controller.insert(createDefaultSection('post-list'), { index: 1 })).toThrow(
      'cannot mutate shared section structure',
    );
    expect(() => controller.delete(SECTION_ID)).toThrow('cannot mutate shared section structure');
    expect(() => controller.move(SECTION_ID, { index: 0 })).toThrow('cannot mutate shared section structure');
    expect(() => controller.update(SECTION_ID, { settings: { paddingTop: '24' } })).toThrow(
      'cannot mutate shared section structure',
    );

    controller.updateLocaleProps(SECTION_ID, { caption: 'Updated description' });
    expect(controller.read()[0]?.props?.caption).toBe('Updated description');
    const after = materializeCanonicalBlockRoom(document, 'page');
    if (after.$typeName !== 'api.content.v1.LocalizedPageDocument') {
      throw new Error('Expected localized Page document.');
    }
    expect(after.base).toEqual(baseBefore);

    const reloaded = new Y.Doc();
    hydrateCanonicalBlockRoom(reloaded, 'page', 'ko', after, []);
    expect(createBlockRoomPageSectionsController(reloaded, 'en').read()[0]?.props?.caption).toBe('Updated description');
    reloaded.destroy();
  });
});
