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
