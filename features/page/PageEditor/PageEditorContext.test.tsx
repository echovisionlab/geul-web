// @vitest-environment jsdom

import { fromJson, type JsonValue } from '@bufbuild/protobuf';
import type { HocuspocusProvider } from '@hocuspocus/provider';
import { contentBlockCatalogFingerprint } from '@echovisionlab/geul-proto/content/block_catalog.ts';
import { LocalizedPageDocumentSchema } from '@echovisionlab/geul-proto/content/block_content_pb.ts';
import { hydrateCanonicalBlockRoom } from '@echovisionlab/geul-common/collaboration/block-room-codec';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';
import { flushEditorSaves } from '@/lib/editor/editor-save-registry';
import { createBlockRoomProseMirrorBridge } from '@/features/editor/tiptap/block-room-prosemirror-bridge';
import { PageEditorProvider, usePageEditor } from './PageEditorContext';

const { persistCollaborativeDocumentNow } = vi.hoisted(() => ({
  persistCollaborativeDocumentNow: vi.fn<() => Promise<void>>(),
}));

vi.mock('@mantine/notifications', () => ({ notifications: { show: vi.fn() } }));
vi.mock('@/lib/collab/persist-now', () => ({ persistCollaborativeDocumentNow }));
vi.mock('@/lib/utils/client-logger', () => ({
  createClientLogger: () => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() }),
}));

let roomDocument: Y.Doc;
let container: HTMLDivElement;
let root: Root;
let current: ReturnType<typeof usePageEditor> | null;
const provider = { name: 'one-page-room' } as unknown as HocuspocusProvider;
const SECTION_ID = '019cce25-dbc0-7d12-9f1f-735b1a6c6b14';
const RICH_TEXT_BLOCK_ID = '019cce25-dbc0-7d12-9f1f-735b1a6c6b15';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function createRoom(locale = 'ko', sourceLocale = 'ko', withSection = false): Y.Doc {
  const value = new Y.Doc();
  hydrateCanonicalBlockRoom(
    value,
    'page',
    sourceLocale,
    fromJson(LocalizedPageDocumentSchema, {
      blockCatalogFingerprint: contentBlockCatalogFingerprint,
      locale,
      base: {
        nodes: withSection
          ? [
              {
                section: {
                  id: SECTION_ID,
                  externalVideo: { props: { uri: 'https://video.example/watch/1' } },
                },
                placement: { index: 0 },
              },
            ]
          : [],
      },
      localeOverlay: {
        locale,
        sections: withSection
          ? [
              {
                sectionId: SECTION_ID,
                externalVideo: { props: { caption: locale === sourceLocale ? '한국어' : 'English' } },
              },
            ]
          : [],
      },
    } as JsonValue),
    [],
  );
  return value;
}

function createRichTextRoom(): Y.Doc {
  const value = new Y.Doc();
  hydrateCanonicalBlockRoom(
    value,
    'page',
    'ko',
    fromJson(LocalizedPageDocumentSchema, {
      blockCatalogFingerprint: contentBlockCatalogFingerprint,
      locale: 'ko',
      base: {
        nodes: [
          {
            section: {
              id: SECTION_ID,
              richText: {
                props: {},
                blocks: {
                  nodes: [
                    {
                      block: { id: RICH_TEXT_BLOCK_ID, paragraph: { props: {} } },
                      placement: { index: 0 },
                    },
                  ],
                },
              },
            },
            placement: { index: 0 },
          },
        ],
      },
      localeOverlay: {
        locale: 'ko',
        sections: [
          {
            sectionId: SECTION_ID,
            richText: {
              props: {},
              blocks: {
                locale: 'ko',
                blocks: [
                  {
                    blockId: RICH_TEXT_BLOCK_ID,
                    paragraph: { props: {}, content: [{ text: { text: 'Page body' } }] },
                  },
                ],
              },
            },
          },
        ],
      },
    } as JsonValue),
    [],
  );
  return value;
}

function Harness() {
  current = usePageEditor();
  return null;
}

function render(editable = true, locale = 'ko', allowStructuralEdits = editable): void {
  act(() => {
    root.render(
      <PageEditorProvider
        doc={roomDocument}
        provider={provider}
        locale={locale}
        userName="tester"
        pageId="page-1"
        editable={editable}
        allowStructuralEdits={allowStructuralEdits}
      >
        <Harness />
      </PageEditorProvider>,
    );
  });
}

function context(): ReturnType<typeof usePageEditor> {
  if (!current) {
    throw new Error('Page editor context is unavailable.');
  }
  return current;
}

async function flush(): Promise<void> {
  await act(async () => Promise.resolve());
}

beforeEach(() => {
  roomDocument = createRoom();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  current = null;
  persistCollaborativeDocumentNow.mockReset();
  persistCollaborativeDocumentNow.mockResolvedValue(undefined);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  roomDocument.destroy();
});

describe('typed resident Page editor context', () => {
  it('inserts shared structure and the exact locale overlay into one resident source room', async () => {
    render();
    act(() => {
      context().addSection('external-video', undefined, { url: 'https://video.example/watch/1' });
    });
    await flush();

    expect(context().sections).toEqual([
      expect.objectContaining({
        type: 'external-video',
        props: expect.objectContaining({ url: 'https://video.example/watch/1' }),
      }),
    ]);
    expect(persistCollaborativeDocumentNow).toHaveBeenCalledOnce();
    expect(persistCollaborativeDocumentNow).toHaveBeenCalledWith(provider);
  });

  it('holds locale-save flush until a Page section deletion is durably acknowledged', async () => {
    roomDocument.destroy();
    roomDocument = createRoom('ko', 'ko', true);
    render();
    const persist = deferred<void>();
    persistCollaborativeDocumentNow.mockReturnValueOnce(persist.promise);

    act(() => context().deleteSection(SECTION_ID));
    const flushed = flushEditorSaves('page:page-1');
    let settled = false;
    void flushed.then(() => {
      settled = true;
    });
    await act(async () => Promise.resolve());

    expect(persistCollaborativeDocumentNow).toHaveBeenCalledOnce();
    expect(settled).toBe(false);
    persist.resolve();
    await expect(flushed).resolves.toBe(true);
  });

  it('registers localized Page props and rich-text edits with the locale-save barrier', async () => {
    roomDocument.destroy();
    roomDocument = createRoom('ko', 'ko', true);
    render();
    const propsPersist = deferred<void>();
    persistCollaborativeDocumentNow.mockReturnValueOnce(propsPersist.promise);
    act(() => context().updateLocalizedSectionProps(SECTION_ID, { caption: 'Updated caption' }));
    const flushProps = flushEditorSaves('page:page-1');
    let propsFlushSettled = false;
    void flushProps.then(() => {
      propsFlushSettled = true;
    });
    await act(async () => Promise.resolve());
    expect(propsFlushSettled).toBe(false);
    expect(persistCollaborativeDocumentNow).toHaveBeenCalledOnce();
    propsPersist.resolve();
    await expect(flushProps).resolves.toBe(true);

    roomDocument.destroy();
    roomDocument = createRichTextRoom();
    render();
    const richTextPersist = deferred<void>();
    persistCollaborativeDocumentNow.mockReturnValueOnce(richTextPersist.promise);
    const bridge = createBlockRoomProseMirrorBridge({
      document: roomDocument,
      documentType: 'page',
      locale: 'ko',
      pageSectionId: SECTION_ID,
    });
    act(() => {
      bridge.replaceCollaborativeText({
        blockId: RICH_TEXT_BLOCK_ID,
        scope: 'locale',
        path: 'content[0].text.text',
        from: 0,
        to: 9,
        insert: 'Fresh body',
      });
    });

    const flushRichText = flushEditorSaves('page:page-1');
    let richTextFlushSettled = false;
    void flushRichText.then(() => {
      richTextFlushSettled = true;
    });
    await act(async () => Promise.resolve());
    expect(richTextFlushSettled).toBe(false);
    expect(persistCollaborativeDocumentNow).toHaveBeenCalledTimes(2);
    richTextPersist.resolve();
    await expect(flushRichText).resolves.toBe(true);
  });

  it('keeps edits made during a save pending, vetoes on failure, and allows a retry', async () => {
    roomDocument.destroy();
    roomDocument = createRoom('ko', 'ko', true);
    render();
    const first = deferred<void>();
    const second = deferred<void>();
    persistCollaborativeDocumentNow.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);

    act(() => context().updateLocalizedSectionProps(SECTION_ID, { caption: 'First edit' }));
    const flushing = flushEditorSaves('page:page-1');
    await act(async () => Promise.resolve());
    act(() => context().updateLocalizedSectionProps(SECTION_ID, { caption: 'Second edit' }));
    first.resolve();
    await act(async () => Promise.resolve());

    expect(persistCollaborativeDocumentNow).toHaveBeenCalledTimes(2);
    let settled = false;
    void flushing.then(() => {
      settled = true;
    });
    await act(async () => Promise.resolve());
    expect(settled).toBe(false);
    second.resolve();
    await expect(flushing).resolves.toBe(true);

    act(() => context().updateLocalizedSectionProps(SECTION_ID, { caption: 'Retry edit' }));
    persistCollaborativeDocumentNow.mockRejectedValueOnce(new Error('persistence rejected'));
    await expect(flushEditorSaves('page:page-1')).resolves.toBe(false);
    persistCollaborativeDocumentNow.mockResolvedValueOnce(undefined);
    await expect(flushEditorSaves('page:page-1')).resolves.toBe(true);
  });

  it('rechecks the current Page document after a pending save belongs to a stale document', async () => {
    roomDocument.destroy();
    roomDocument = createRoom('ko', 'ko', true);
    render();
    const oldDocumentPersist = deferred<void>();
    const currentDocumentPersist = deferred<void>();
    persistCollaborativeDocumentNow
      .mockReturnValueOnce(oldDocumentPersist.promise)
      .mockReturnValueOnce(currentDocumentPersist.promise);

    act(() => context().updateLocalizedSectionProps(SECTION_ID, { caption: 'Old document edit' }));
    const flushing = flushEditorSaves('page:page-1');
    await act(async () => Promise.resolve());
    expect(persistCollaborativeDocumentNow).toHaveBeenCalledOnce();

    roomDocument.destroy();
    roomDocument = createRoom('ko', 'ko', true);
    render();
    act(() => context().updateLocalizedSectionProps(SECTION_ID, { caption: 'Current document edit' }));
    oldDocumentPersist.resolve();
    await act(async () => Promise.resolve());

    expect(persistCollaborativeDocumentNow).toHaveBeenCalledTimes(2);
    let settled = false;
    void flushing.then(() => {
      settled = true;
    });
    await act(async () => Promise.resolve());
    expect(settled).toBe(false);
    currentDocumentPersist.resolve();
    await expect(flushing).resolves.toBe(true);
  });

  it('rejects unconfigured external-video and Form insertion without creating a Block', () => {
    render();

    expect(() => context().addSection('external-video')).toThrow('External video URL is required');
    expect(() => context().addSection('form')).toThrow('published Form is required');
    expect(context().sections).toEqual([]);
    expect(persistCollaborativeDocumentNow).not.toHaveBeenCalled();
  });

  it('routes source-owned updates to the one source overlay without replacing structure', () => {
    render();
    let sectionId = '';
    act(() => {
      sectionId = context().addSection('external-video', undefined, {
        url: 'https://video.example/watch/1',
        caption: '한국어',
      })!.id;
      context().updateLocalizedSectionProps(sectionId, { caption: '수정됨' });
    });

    expect(context().sections[0]?.props).toEqual(expect.objectContaining({ caption: '수정됨' }));
    expect(context().sections[0]?.id).toBe(sectionId);
    expect(context().sections[0]?.props?.caption).toBe('수정됨');
  });

  it('makes every mutation a no-op when the editor is read-only', () => {
    render(false);
    act(() => {
      context().addSection('post-list');
      context().moveSections(0, 1);
      context().deleteSection('missing');
    });

    expect(context().sections).toEqual([]);
    expect(persistCollaborativeDocumentNow).not.toHaveBeenCalled();
  });

  it('keeps target locale leaves editable while every structure command is fail-closed', () => {
    roomDocument.destroy();
    roomDocument = createRoom('en', 'ko', true);
    render(true, 'en', false);

    act(() => {
      context().updateLocalizedSectionProps(SECTION_ID, { caption: 'Updated English' });
      context().updateSection(SECTION_ID, { settings: { paddingTop: '24' } });
      context().deleteSection(SECTION_ID);
      context().addSection('post-list');
      context().moveSections(0, 0);
    });

    expect(context().sections).toEqual([
      expect.objectContaining({
        id: SECTION_ID,
        props: expect.objectContaining({
          url: 'https://video.example/watch/1',
          caption: 'Updated English',
        }),
      }),
    ]);
    expect(context().editable).toBe(true);
    expect(context().allowStructuralEdits).toBe(false);
    expect(persistCollaborativeDocumentNow).not.toHaveBeenCalled();
  });
});
