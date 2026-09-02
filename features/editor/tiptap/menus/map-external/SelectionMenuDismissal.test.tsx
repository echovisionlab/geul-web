// @vitest-environment jsdom

import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Editor } from '@tiptap/core';
import { NodeSelection, TextSelection } from '@tiptap/pm/state';
import { MantineProvider } from '@mantine/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTiptapWireExtensions } from '../../wire-schema';
import type { ExternalVideoSelectionMenuLabels } from './ExternalVideoSelectionMenu';
import type { MapSelectionMenuLabels } from './MapSelectionMenu';
import { createTiptapMapSelectionMenuRegistry } from './MapSelectionMenuRegistry';
import { TiptapExternalVideoSelectionBubbleMenu } from './TiptapExternalVideoSelectionBubbleMenu';
import { TiptapMapSelectionBubbleMenu } from './TiptapMapSelectionBubbleMenu';

vi.mock('@tiptap/react/menus', () => ({
  BubbleMenu: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

const mapLabels: MapSelectionMenuLabels = {
  menu: 'Map controls',
  places: 'Places',
  addPlace: 'Add place',
  centerPlace: 'Center map',
  removePlace: 'Remove place',
  alignment: 'Alignment',
  alignLeft: 'Align left',
  alignCenter: 'Align center',
  alignRight: 'Align right',
  width: 'Width',
  resizeHint: 'Resize',
  resizing: 'Resizing',
  focusCaption: 'Edit caption',
  deleteBlock: 'Delete map',
};

const externalVideoLabels: ExternalVideoSelectionMenuLabels = {
  menu: 'External video controls',
  editLink: 'Edit link',
  aspectRatio: 'Aspect ratio',
  automaticAspectRatio: 'Automatic',
  alignment: 'Alignment',
  alignLeft: 'Align left',
  alignCenter: 'Align center',
  alignRight: 'Align right',
  width: 'Width',
  resizeHint: 'Resize',
};

const paragraph = (id: string, content?: Record<string, unknown>[]) => ({
  type: 'blockContainer',
  attrs: { id },
  content: [
    {
      type: 'paragraph',
      attrs: {
        backgroundColor: 'default',
        textColor: 'default',
        textAlignment: 'left',
        previewWidth: '100',
        aspectRatio: 'auto',
      },
      content,
    },
  ],
});

let container: HTMLDivElement;
let root: Root;
let editors: Editor[];
let editorElements: HTMLDivElement[];
let registrations: (() => void)[];

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  editors = [];
  editorElements = [];
  registrations = [];
});

afterEach(() => {
  act(() => root.unmount());
  registrations.forEach((unregister) => unregister());
  editors.forEach((editor) => editor.destroy());
  editorElements.forEach((element) => element.remove());
  container.remove();
});

function createEditor(content: Record<string, unknown>[]): Editor {
  const element = document.createElement('div');
  document.body.appendChild(element);
  editorElements.push(element);
  const editor = new Editor({
    element,
    extensions: createTiptapWireExtensions(),
    content: { type: 'doc', content: [{ type: 'blockGroup', content }] },
  });
  editors.push(editor);
  return editor;
}

function blockPosition(editor: Editor, id: string): number {
  let result = -1;
  editor.state.doc.descendants((node, position) => {
    if (result < 0 && node.type.name === 'blockContainer' && node.attrs.id === id) {
      result = position;
    }
  });
  if (result < 0) {
    throw new Error(`Missing test block: ${id}`);
  }
  return result;
}

function assertDismissedUntilSelectionChanges({
  editor,
  menuTestId,
  selectedPosition,
  otherPosition,
}: {
  editor: Editor;
  menuTestId: string;
  selectedPosition: number;
  otherPosition: number;
}) {
  const beforeSelection = editor.state.selection.toJSON();
  const toolbar = container.querySelector<HTMLElement>(`[data-testid="${menuTestId}"]`)!;
  const action = toolbar.querySelector<HTMLElement>('[data-selection-toolbar-action]')!;

  act(() => {
    action.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  });
  expect(editor.state.selection).toBeInstanceOf(NodeSelection);
  expect(editor.state.selection.toJSON()).toEqual(beforeSelection);
  expect(container.querySelector(`[data-testid="${menuTestId}"]`)).toBeNull();

  act(() => {
    editor.view.dispatch(editor.state.tr.setMeta('tiptap.test.same-selection-refresh', true));
  });
  expect(container.querySelector(`[data-testid="${menuTestId}"]`)).toBeNull();

  act(() => {
    editor.view.dispatch(editor.state.tr.setSelection(TextSelection.create(editor.state.doc, otherPosition + 2)));
  });
  expect(container.querySelector(`[data-testid="${menuTestId}"]`)).toBeNull();

  act(() => {
    editor.view.dispatch(editor.state.tr.setSelection(NodeSelection.create(editor.state.doc, selectedPosition)));
  });
  expect(container.querySelector(`[data-testid="${menuTestId}"]`)).not.toBeNull();
}

describe('map and external-video selection menu dismissal', () => {
  it('keeps the selected map closed after Escape and reopens it only after selection changes', () => {
    const editor = createEditor([
      {
        type: 'blockContainer',
        attrs: { id: 'map' },
        content: [
          {
            type: 'map',
            attrs: {
              mapPlaceIds: '',
              centerLat: '',
              centerLng: '',
              previewWidth: '72',
              textAlignment: 'center',
              caption: '',
              aspectRatio: '16:9',
              themeId: '',
              preferredScheme: 'dark',
            },
          },
        ],
      },
      paragraph('tail', [{ type: 'text', text: 'Tail' }]),
    ]);
    const selectedPosition = blockPosition(editor, 'map');
    const otherPosition = blockPosition(editor, 'tail');
    editor.view.dispatch(editor.state.tr.setSelection(NodeSelection.create(editor.state.doc, selectedPosition)));
    const registry = createTiptapMapSelectionMenuRegistry();
    registrations.push(
      registry.register('map', {
        snapshot: { places: [], textAlignment: 'center', previewWidth: '72' },
        commands: { deleteBlock: () => undefined },
      }),
    );

    act(() => {
      root.render(
        <MantineProvider env="test">
          <TiptapMapSelectionBubbleMenu editor={editor} labels={mapLabels} registry={registry} />
        </MantineProvider>,
      );
    });
    expect(container.querySelector('[data-testid="tiptap-map-menu"]')).not.toBeNull();

    assertDismissedUntilSelectionChanges({
      editor,
      menuTestId: 'tiptap-map-menu',
      selectedPosition,
      otherPosition,
    });
  });

  it('keeps the selected external video closed after Escape and reopens it only after selection changes', () => {
    const editor = createEditor([
      {
        type: 'blockContainer',
        attrs: { id: 'external-video' },
        content: [
          {
            type: 'externalVideo',
            attrs: {
              url: 'https://youtu.be/dQw4w9WgXcQ',
              label: 'Video',
              previewWidth: '100',
              aspectRatio: 'auto',
              textAlignment: 'left',
              sourceContent: [
                {
                  type: 'text',
                  text: 'Video',
                  marks: [{ type: 'link', attrs: { href: 'https://youtu.be/dQw4w9WgXcQ' } }],
                },
              ],
            },
          },
        ],
      },
      paragraph('tail', [{ type: 'text', text: 'Tail' }]),
    ]);
    const selectedPosition = blockPosition(editor, 'external-video');
    const otherPosition = blockPosition(editor, 'tail');
    editor.view.dispatch(editor.state.tr.setSelection(NodeSelection.create(editor.state.doc, selectedPosition)));

    act(() => {
      root.render(
        <MantineProvider env="test">
          <TiptapExternalVideoSelectionBubbleMenu editor={editor} labels={externalVideoLabels} />
        </MantineProvider>,
      );
    });
    expect(container.querySelector('[data-testid="tiptap-external-video-selection-menu"]')).not.toBeNull();

    assertDismissedUntilSelectionChanges({
      editor,
      menuTestId: 'tiptap-external-video-selection-menu',
      selectedPosition,
      otherPosition,
    });
  });
});
