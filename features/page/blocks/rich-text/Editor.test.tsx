// @vitest-environment jsdom

import { materializeCanonicalBlockRoom } from '@echovisionlab/geul-common/collaboration/block-room-codec';
import type { Editor } from '@tiptap/core';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type * as Y from 'yjs';
import type { RichTextBlockRoomTiptapController } from '@/features/editor/tiptap/block-room-tiptap-controller';
import { createBlockRoomPageSectionsController } from '@/features/page/PageEditor/block-room-page-sections';
import { PageEditorProvider } from '@/features/page/PageEditor/PageEditorContext';
import { createDefaultSection } from '@/features/page/PageEditor/types';
import { localDocumentRoom } from '@/stories/pages/fixtures/document-editor-room';
import { TestProviders } from '@/test/TestProviders';
import { RichTextEditor } from './Editor';

const surface = vi.hoisted(() => ({ props: vi.fn(), editor: null as Editor | null }));

// Stands in for the collaborative Tiptap surface and its media and server services. Like TiptapEditor, it
// builds the editor from the controller's extension and initial content and connects it, so the Page wiring,
// the section-scoped controller and the resident room stay real.
vi.mock('@/features/translation/LocalizedRichTextFragmentEditor', async () => {
  const { useEffect, useRef } = await import('react');
  const { Editor: TiptapEditor } = await import('@tiptap/core');
  const { createTiptapWireExtensions } = await import('@/features/editor/tiptap/wire-schema');
  return {
    LocalizedRichTextFragmentEditor: (props: {
      blockRoomController: RichTextBlockRoomTiptapController;
      editable: boolean;
    }) => {
      surface.props(props);
      const host = useRef<HTMLDivElement>(null);
      const { blockRoomController, editable } = props;
      useEffect(() => {
        const editor = new TiptapEditor({
          element: host.current!,
          extensions: [...createTiptapWireExtensions(), blockRoomController.extension],
          content: blockRoomController.initialContent,
          editable,
        });
        const disconnect = blockRoomController.connect(editor);
        surface.editor = editor;
        return () => {
          disconnect();
          editor.destroy();
          surface.editor = null;
        };
      }, [blockRoomController, editable]);
      return <div ref={host} />;
    },
  };
});

let container: HTMLDivElement | null = null;
let root: Root | null = null;
let room: ReturnType<typeof localDocumentRoom> | null = null;

afterEach(() => {
  act(() => root?.unmount());
  room?.destroy();
  container?.remove();
  container = null;
  root = null;
  room = null;
  surface.props.mockReset();
});

/** A resident English Page room holding two rich-text sections. */
function twoSectionRoom() {
  room = localDocumentRoom('page', 'en');
  const sections = createBlockRoomPageSectionsController(room.document, 'en');
  sections.insert(createDefaultSection('rich-text'), { index: 1 });
  const [own, other] = sections.read();
  return { room, own: own!.id, other: other!.id };
}

function renderSection(
  target: ReturnType<typeof localDocumentRoom>,
  sectionId: string,
  { editable, allowStructuralEdits }: { editable: boolean; allowStructuralEdits: boolean },
) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() =>
    root?.render(
      <TestProviders>
        <PageEditorProvider
          doc={target.document}
          provider={target.provider}
          protocol={target.protocol}
          locale="en"
          userName="Author"
          pageId="local-page"
          editable={editable}
          allowStructuralEdits={allowStructuralEdits}
        >
          <RichTextEditor sectionId={sectionId} props={{}} />
        </PageEditorProvider>
      </TestProviders>,
    ),
  );
}

function collectText(value: unknown): string {
  if (Array.isArray(value)) {
    return value.map(collectText).join('');
  }
  if (value && typeof value === 'object') {
    return Object.entries(value)
      .map(([key, item]) => (key === 'text' && typeof item === 'string' ? item : collectText(item)))
      .join('');
  }
  return '';
}

/** The persisted English text of one Page section, read back from the canonical room. */
function sectionText(document: Y.Doc, sectionId: string): string {
  const page = materializeCanonicalBlockRoom(document, 'page');
  if (page.$typeName !== 'api.content.v1.LocalizedPageDocument') {
    throw new Error('Expected localized Page document.');
  }
  const section = page.localeOverlay?.sections.find((item) => item.sectionId === sectionId);
  if (!section) {
    throw new Error(`Missing Page section ${sectionId}.`);
  }
  return collectText(section);
}

function firstParagraphPosition(editor: Editor): number {
  let position = -1;
  editor.state.doc.descendants((node, offset) => {
    if (position === -1 && node.type.name === 'paragraph') {
      position = offset;
    }
    return position === -1;
  });
  if (position < 0) {
    throw new Error('Expected a paragraph in the section editor.');
  }
  return position;
}

describe('Page RichTextEditor', () => {
  it('writes typed text into its own section of the resident Page room and nowhere else', () => {
    const { room: target, own, other } = twoSectionRoom();
    renderSection(target, own, { editable: true, allowStructuralEdits: true });
    const editor = surface.editor;
    if (!editor) {
      throw new Error('Section editor did not mount.');
    }

    act(() => {
      editor.view.dispatch(editor.state.tr.insertText('Own section copy', firstParagraphPosition(editor) + 1));
    });

    expect(sectionText(target.document, own)).toBe('Own section copy');
    expect(sectionText(target.document, other)).toBe('');
    expect(surface.props).toHaveBeenLastCalledWith(
      expect.objectContaining({
        editable: true,
        allowStructuralEdits: true,
      }),
    );
  });

  it('opens a read-only section without structural edits', () => {
    const { room: target, own } = twoSectionRoom();
    renderSection(target, own, { editable: false, allowStructuralEdits: false });

    expect(surface.editor?.isEditable).toBe(false);
    expect(surface.props).toHaveBeenLastCalledWith(
      expect.objectContaining({ editable: false, allowNeutralBlockEdits: false, allowStructuralEdits: false }),
    );
  });
});
