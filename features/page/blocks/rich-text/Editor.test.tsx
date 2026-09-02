// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';
import { RichTextEditor } from './Editor';

const { localizedEditorSpy, usePageEditorSpy, createBridgeSpy, createControllerSpy } = vi.hoisted(() => ({
  localizedEditorSpy: vi.fn(),
  usePageEditorSpy: vi.fn(),
  createBridgeSpy: vi.fn(() => ({ kind: 'page-bridge' })),
  createControllerSpy: vi.fn(() => ({ kind: 'typed-page-controller' })),
}));

vi.mock('@/features/translation/LocalizedRichTextFragmentEditor', () => ({
  LocalizedRichTextFragmentEditor: (props: unknown) => {
    localizedEditorSpy(props);
    return <div>typed rich-text editor</div>;
  },
}));
vi.mock('@/features/page/PageEditor/PageEditorContext', () => ({ usePageEditor: usePageEditorSpy }));
vi.mock('@/features/editor/tiptap/block-room-prosemirror-bridge', () => ({
  createBlockRoomProseMirrorBridge: createBridgeSpy,
}));
vi.mock('@/features/editor/tiptap/block-room-tiptap-controller', () => ({
  createRichTextBlockRoomTiptapController: createControllerSpy,
}));

let container: HTMLDivElement | null = null;
let root: Root | null = null;

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  container = null;
  root = null;
  localizedEditorSpy.mockReset();
  createBridgeSpy.mockClear();
  createControllerSpy.mockClear();
});

describe('Page RichTextEditor', () => {
  it('binds the Page section to the typed resident bridge without legacy fragments', () => {
    const document = new Y.Doc();
    const provider = { name: 'resident-page-room' };
    usePageEditorSpy.mockReturnValue({
      doc: document,
      provider,
      locale: 'en',
      userName: 'tester',
      pageId: 'page-1',
      editable: true,
      allowStructuralEdits: true,
    });
    container = window.document.createElement('div');
    window.document.body.appendChild(container);
    root = createRoot(container);

    act(() => root?.render(<RichTextEditor sectionId="section-rich" props={{}} />));

    expect(createBridgeSpy).toHaveBeenCalledWith({
      document,
      documentType: 'page',
      locale: 'en',
      pageSectionId: 'section-rich',
    });
    expect(createControllerSpy).toHaveBeenCalledWith({ kind: 'page-bridge' });
    expect(localizedEditorSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        provider,
        blockRoomController: { kind: 'typed-page-controller' },
        userName: 'tester',
        editable: true,
        entityId: 'page-1',
        allowNeutralBlockEdits: true,
        allowStructuralEdits: true,
        aiTarget: { type: 'page', id: 'page-1', locale: 'en' },
      }),
    );
    expect(localizedEditorSpy.mock.lastCall?.[0]).not.toHaveProperty('fragment');
    expect(localizedEditorSpy.mock.lastCall?.[0]).not.toHaveProperty('neutralFragment');
    document.destroy();
  });
});
