// @vitest-environment jsdom

import { act, isValidElement, type ReactNode } from 'react';
import type { Editor } from '@tiptap/core';
import { TranscodeEntityType } from '@echovisionlab/geul-proto/secure/events_pb.ts';
import type { HocuspocusProvider } from '@hocuspocus/provider';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RichTextBlockRoomTiptapController } from '@/features/editor/tiptap/block-room-tiptap-controller';
import type { EditorMediaCommandPort } from '@/features/editor/lib/media-block-updates';
import type { TiptapSlashActionContext } from '@/features/editor/tiptap/slash/types';
import { LocalizedCollaborativeRichTextEditor } from './LocalizedCollaborativeRichTextEditor';

const { createMediaPortSpy, runtimeContext } = vi.hoisted(() => ({
  createMediaPortSpy: vi.fn(),
  runtimeContext: { current: null as unknown },
}));

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
  useOptionalEditorRuntimeContext: () => runtimeContext.current,
}));
vi.mock('@/components/core/Notification', () => ({ notifications: { show: vi.fn() } }));
vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));

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

function runtimeEntityType(entityType: TranscodeEntityType | null | undefined): string {
  switch (entityType) {
    case TranscodeEntityType.PAGE:
      return 'page';
    case TranscodeEntityType.WORK:
      return 'work';
    case TranscodeEntityType.PROGRAM_EVENT:
      return 'program_event';
    case TranscodeEntityType.POST:
    default:
      return 'post';
  }
}

function render(element: ReactNode, runtimeOverride?: unknown): void {
  const props = isValidElement(element)
    ? (element.props as {
        provider?: HocuspocusProvider;
        entityId?: string | null;
        entityType?: TranscodeEntityType | null;
      })
    : null;
  runtimeContext.current =
    runtimeOverride === undefined
      ? props
        ? {
            provider: props.provider,
            entityType: runtimeEntityType(props.entityType),
            entityId: props.entityId ?? '',
          }
        : null
      : runtimeOverride;
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
  runtimeContext.current = null;
});

describe('typed Block-room collaborative rich-text editor', () => {
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

  it.each(['absent', 'provider', 'entityType', 'entityId'] as const)(
    'requires a matching owning runtime context when %s differs',
    (mismatch) => {
      const residentProvider = provider();
      const editor = (
        <LocalizedCollaborativeRichTextEditor
          provider={residentProvider}
          blockRoomController={controller()}
          userName="editor"
          editable
          entityId="post-1"
          entityType={TranscodeEntityType.POST}
        />
      );
      const mismatchedRuntime =
        mismatch === 'absent'
          ? null
          : {
              provider: mismatch === 'provider' ? provider() : residentProvider,
              entityType: mismatch === 'entityType' ? 'page' : 'post',
              entityId: mismatch === 'entityId' ? 'post-2' : 'post-1',
            };

      expect(() => render(editor, mismatchedRuntime)).toThrow('requires its owning entity editor runtime');
    },
  );
});
