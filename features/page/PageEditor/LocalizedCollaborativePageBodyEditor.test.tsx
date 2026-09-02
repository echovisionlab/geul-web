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
import { TestProviders } from '@/test/TestProviders';
import { createDefaultSection } from './types';
import { createBlockRoomPageSectionsController } from './block-room-page-sections';
import { PageEditorProvider } from './PageEditorContext';
import { LocalizedCollaborativePageBodyEditor } from './LocalizedCollaborativePageBodyEditor';

const { richTextEditorSpy } = vi.hoisted(() => ({ richTextEditorSpy: vi.fn() }));

vi.mock('@/features/translation/LocalizedRichTextFragmentEditor', () => ({
  LocalizedRichTextFragmentEditor: (props: unknown) => {
    richTextEditorSpy(props);
    return <div data-rich-text-editor />;
  },
}));
vi.mock('@/features/page/blocks/map/Editor', () => ({ MapEditor: () => <div data-map-editor /> }));
vi.mock('@/features/page/blocks/map/View', () => ({ MapView: () => <div data-map-view /> }));
vi.mock('@/lib/collab/persist-now', () => ({ persistCollaborativeDocumentNow: vi.fn() }));

let roomDocument: Y.Doc;
let container: HTMLDivElement;
let root: Root;
const provider = { name: 'resident-page-room' } as unknown as HocuspocusProvider;
const RICH_SECTION_ID = '019cce25-dbc0-7d12-9f1f-735b1a6c6b14';
const BLOCK_ID = '019cce25-dbc0-7d12-9f1f-735b1a6c6b15';

function room(): Y.Doc {
  const value = new Y.Doc();
  hydrateCanonicalBlockRoom(
    value,
    'page',
    'ko',
    fromJson(LocalizedPageDocumentSchema, {
      blockCatalogFingerprint: contentBlockCatalogFingerprint,
      locale: 'ko',
      base: { nodes: [] },
      localeOverlay: { locale: 'ko', sections: [] },
    } as JsonValue),
    [],
  );
  return value;
}

function targetRichTextRoom(): Y.Doc {
  const value = new Y.Doc();
  hydrateCanonicalBlockRoom(
    value,
    'page',
    'ko',
    fromJson(LocalizedPageDocumentSchema, {
      blockCatalogFingerprint: contentBlockCatalogFingerprint,
      locale: 'en',
      base: {
        nodes: [
          {
            section: {
              id: RICH_SECTION_ID,
              richText: {
                props: {},
                blocks: {
                  nodes: [
                    {
                      block: { id: BLOCK_ID, paragraph: { props: {} } },
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
        locale: 'en',
        sections: [
          {
            sectionId: RICH_SECTION_ID,
            richText: {
              props: {},
              blocks: {
                locale: 'en',
                blocks: [
                  {
                    blockId: BLOCK_ID,
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

function render(locale: string, editable = true): void {
  act(() => {
    root.render(
      <TestProviders locale={locale}>
        <PageEditorProvider
          doc={roomDocument}
          provider={provider}
          locale={locale}
          userName="tester"
          pageId="page-1"
          editable={editable}
          allowStructuralEdits={locale === 'ko' && editable}
        >
          <LocalizedCollaborativePageBodyEditor fallbackText="No sections" editable={editable} />
        </PageEditorProvider>
      </TestProviders>,
    );
  });
}

beforeEach(() => {
  roomDocument = room();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  richTextEditorSpy.mockReset();
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  roomDocument.destroy();
});

describe('typed resident localized Page body', () => {
  it('renders nested rich text from the same resident room through a typed controller', () => {
    const nested = createDefaultSection('rich-text');
    const columns = createDefaultSection('columns');
    if (columns.type !== 'columns') {
      throw new Error('Expected Columns section.');
    }
    createBlockRoomPageSectionsController(roomDocument, 'ko').insert(
      {
        ...columns,
        columns: [{ ...columns.columns[0]!, sections: [nested] }, columns.columns[1]!],
      },
      { index: 0 },
    );

    render('ko');

    expect(container.querySelector('[data-rich-text-editor]')).not.toBeNull();
    expect(richTextEditorSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        provider,
        blockRoomController: expect.objectContaining({
          connect: expect.any(Function),
          getLocalizedDocumentSnapshot: expect.any(Function),
        }),
        userName: 'tester',
        editable: true,
        entityId: 'page-1',
      }),
    );
    expect(richTextEditorSpy.mock.lastCall?.[0]).not.toHaveProperty('fragment');
    expect(richTextEditorSpy.mock.lastCall?.[0]).not.toHaveProperty('neutralFragment');
  });

  it('renders the empty-state without creating a hidden mirror or Block', () => {
    render('ko', false);

    expect(container.textContent).toContain('No sections');
    expect(createBlockRoomPageSectionsController(roomDocument, 'ko').read()).toEqual([]);
    expect(richTextEditorSpy).not.toHaveBeenCalled();
  });

  it('opens exact target rich text with locale-only authoring and exact AI identity', () => {
    roomDocument.destroy();
    roomDocument = targetRichTextRoom();

    render('en');

    expect(richTextEditorSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        editable: true,
        allowNeutralBlockEdits: false,
        allowStructuralEdits: false,
        aiTarget: { type: 'page', id: 'page-1', locale: 'en' },
      }),
    );
  });
});
