// @vitest-environment jsdom

import { act, type ReactNode } from 'react';
import type { Editor } from '@tiptap/core';
import { TranscodeEntityType } from '@echovisionlab/geul-proto/secure/events_pb.ts';
import type { HocuspocusProvider } from '@hocuspocus/provider';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RichTextBlockRoomTiptapController } from '@/features/editor/tiptap/block-room-tiptap-controller';
import type { EditorMediaCommandPort } from '@/features/editor/lib/media-block-updates';
import type { TiptapSlashActionContext } from '@/features/editor/tiptap/slash/types';
import { LocalizedCollaborativeRichTextEditor } from './LocalizedCollaborativeRichTextEditor';

const { createMediaPortSpy } = vi.hoisted(() => ({ createMediaPortSpy: vi.fn() }));

const editorSpy = vi.fn<(props: Record<string, unknown>) => ReactNode>(() => <div data-typed-editor />);
const mediaSurfaceSpy = vi.fn((_options?: unknown) => ({
  dropFilesAtBlock: vi.fn(async () => false),
  dropFilesAtTarget: vi.fn(async () => false),
  insertFilesAtSavedPosition: vi.fn(async () => []),
  selectLibraryFilesAtBlock: vi.fn(() => false),
  selectLibraryFilesAtSavedPosition: vi.fn(() => false),
  externalImageProgress: null,
  mediaTiptapExtensions: [],
  uploadProgress: null,
}));

vi.mock('@/features/editor/tiptap/TiptapEditor', () => ({
  TiptapEditor: (props: Record<string, unknown>) => editorSpy(props),
}));
vi.mock('@/features/editor/hooks/useEntityMediaSurface', () => ({
  useEntityMediaSurface: (options: unknown) => mediaSurfaceSpy(options),
}));
vi.mock('@/features/editor/lib/media-block-updates', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/editor/lib/media-block-updates')>()),
  createTiptapEditorMediaCommandPort: (...args: unknown[]) => createMediaPortSpy(...args),
}));
vi.mock('@/features/editor/components/MediaFilePanel', () => ({ MediaFilePanel: () => null }));
vi.mock('@/features/editor/components/MediaIngestDialog', () => ({
  MediaIngestDialog: ({ mode }: { mode: string }) => <div data-testid="media-ingest-dialog" data-mode={mode} />,
}));
vi.mock('@/features/editor/components/MediaIngestOverlay', () => ({ MediaIngestOverlay: () => null }));
vi.mock('@/features/editor/MapInsertModal', () => ({ MapInsertModal: () => null }));
vi.mock('@/features/editor/contexts/EditorMediaIngestContext', () => ({
  EditorMediaIngestProvider: ({ children }: { children: ReactNode }) => children,
}));
vi.mock('@/lib/contexts/EditorRuntimeContext', () => ({
  EditorRuntimeProvider: ({ children }: { children: ReactNode }) => children,
}));
vi.mock('@mantine/notifications', () => ({ notifications: { show: vi.fn() } }));
vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
vi.mock('@mantine/core', () => ({
  Box: ({ children, ...props }: { children?: ReactNode }) => <div {...props}>{children}</div>,
}));

let root: Root | null = null;
let container: HTMLDivElement | null = null;

function controller(paragraphExternalVideo = false): RichTextBlockRoomTiptapController {
  return { connected: false, paragraphExternalVideo } as RichTextBlockRoomTiptapController;
}

function provider(withAwareness = true): HocuspocusProvider {
  return {
    ...(withAwareness ? { awareness: { clientID: 1 } } : {}),
  } as unknown as HocuspocusProvider;
}

function render(element: ReactNode): void {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root?.render(element));
}

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
  editorSpy.mockClear();
  mediaSurfaceSpy.mockClear();
  createMediaPortSpy.mockReset();
});

describe('typed Block-room collaborative rich-text editor', () => {
  it('routes one typed controller and never creates a legacy fragment or hidden mirror', () => {
    const blockRoomController = controller();
    const residentProvider = provider();
    render(
      <LocalizedCollaborativeRichTextEditor
        provider={residentProvider}
        blockRoomController={blockRoomController}
        userName="editor"
        editable
        allowNeutralBlockEdits
        allowStructuralEdits
        entityId="post-1"
        entityType={TranscodeEntityType.POST}
      />,
    );

    expect(editorSpy).toHaveBeenCalledOnce();
    expect(editorSpy.mock.calls[0]?.[0]).toMatchObject({
      blockRoomController,
      awareness: residentProvider.awareness,
      editable: true,
      structureLocked: false,
      localUser: { name: 'editor', color: expect.stringMatching(/^#[0-9a-f]{6}$/) },
    });
    expect(editorSpy.mock.calls[0]?.[0]).not.toHaveProperty('fragment');
    expect(container?.querySelector('[data-testid="localized-neutral-tiptap-mirror"]')).toBeNull();
    expect(mediaSurfaceSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: residentProvider,
        mediaCommandProvider: residentProvider,
        allowStructuralEdits: true,
      }),
    );
  });

  it('keeps locale text editable while structural commands remain locked for translators', () => {
    render(
      <LocalizedCollaborativeRichTextEditor
        provider={provider()}
        blockRoomController={controller()}
        userName="translator"
        editable
        entityId="post-1"
        entityType={TranscodeEntityType.POST}
      />,
    );

    expect(editorSpy.mock.calls[0]?.[0]).toMatchObject({ editable: true, structureLocked: true });
    expect(mediaSurfaceSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        allowStructuralEdits: false,
        allowInsertEdits: false,
      }),
    );
  });

  it('passes the exact active locale AI target for localized edits even while neutral structure is locked', () => {
    render(
      <LocalizedCollaborativeRichTextEditor
        provider={provider()}
        blockRoomController={controller()}
        userName="translator"
        editable
        entityId="post-1"
        entityType={TranscodeEntityType.POST}
        aiTarget={{ type: 'post', id: 'post-1', locale: 'ko' }}
      />,
    );

    expect(editorSpy.mock.calls[0]?.[0]).toMatchObject({
      editable: true,
      structureLocked: true,
      ai: { target: { type: 'post', id: 'post-1', locale: 'ko' } },
    });
  });

  it('opens the insert picker when slash file targets a non-file paragraph block', () => {
    const paragraphBlockId = '10000000-0000-4000-8000-000000000001';
    const context = {
      blockId: paragraphBlockId,
      targetBlockId: paragraphBlockId,
      placement: 'replace',
      triggerText: '/file',
      anchorContentJSON: JSON.stringify({ type: 'paragraph', content: [{ type: 'text', text: '/file' }] }),
      range: { from: 3, to: 8, contentPosition: 2, blockId: paragraphBlockId },
    } satisfies TiptapSlashActionContext;
    const mediaPort = {
      getBlock: vi.fn(() => null),
      captureInsertPosition: vi.fn(() => ({ referenceBlockId: paragraphBlockId })),
    } as unknown as EditorMediaCommandPort;
    createMediaPortSpy.mockReturnValue(mediaPort);

    render(
      <LocalizedCollaborativeRichTextEditor
        provider={provider()}
        blockRoomController={controller()}
        userName="editor"
        editable
        allowNeutralBlockEdits
        allowStructuralEdits
        entityId="post-1"
        entityType={TranscodeEntityType.POST}
      />,
    );

    const initialProps = editorSpy.mock.calls[0]?.[0];
    act(() => (initialProps?.onEditorReady as ((editor: Editor | null) => void) | undefined)?.({} as Editor));
    const editorProps = editorSpy.mock.lastCall?.[0];
    act(() =>
      (editorProps?.onFileActivate as ((blockId: string, context?: TiptapSlashActionContext) => void) | undefined)?.(
        paragraphBlockId,
        context,
      ),
    );

    expect(mediaPort.getBlock).toHaveBeenCalledWith(paragraphBlockId);
    expect(mediaPort.captureInsertPosition).toHaveBeenCalledWith(paragraphBlockId);
    expect(container?.querySelector('[data-testid="media-ingest-dialog"]')).toHaveAttribute('data-mode', 'add');
  });

  it.each([
    ['Post', TranscodeEntityType.POST, true],
    ['Page', TranscodeEntityType.PAGE, true],
    ['Work', TranscodeEntityType.WORK, false],
    ['Program Event', TranscodeEntityType.PROGRAM_EVENT, false],
  ])('%s exposes standalone external video only when its typed controller allows it', (_label, entityType, enabled) => {
    render(
      <LocalizedCollaborativeRichTextEditor
        provider={provider()}
        blockRoomController={controller(enabled)}
        userName="editor"
        editable
        allowNeutralBlockEdits
        allowStructuralEdits
        entityId="entity-1"
        entityType={entityType}
      />,
    );

    expect(editorSpy.mock.calls[0]?.[0]?.externalVideo).toBe(enabled ? undefined : false);
  });

  it('fails closed when the resident provider has no awareness authority', () => {
    expect(() =>
      render(
        <LocalizedCollaborativeRichTextEditor
          provider={provider(false)}
          blockRoomController={controller()}
          userName="editor"
          editable
        />,
      ),
    ).toThrow('requires provider awareness');
  });
});
