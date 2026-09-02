// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Editor } from '@tiptap/core';
import { TextSelection } from '@tiptap/pm/state';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createTiptapWireExtensions } from '../wire-schema';
import { TiptapAIAssistant } from './TiptapAIAssistant';
import { TiptapAIAssistantSurface, useTiptapAIController } from './TiptapAIController';
import { resolveTiptapAIContext } from './tiptap-ai';
import type { AIEditorAssistantClient } from '@/lib/ai/editor-orchestration';

const assistantClient = {
  start: vi.fn(),
} as unknown as AIEditorAssistantClient;
const target = { type: 'post' as const, id: 'post-1', locale: 'en' };

vi.mock('@/features/editor/AIMenu/AIMenu', () => ({
  AIAssistant: ({ onClose }: { onClose: () => void }) => (
    <button type="button" data-testid="tiptap-ai-menu" onClick={onClose}>
      AI preview
    </button>
  ),
}));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let element: HTMLDivElement | null = null;
let editor: Editor | null = null;

function createEditor() {
  const mount = document.createElement('div');
  document.body.append(mount);
  return new Editor({
    element: mount,
    extensions: createTiptapWireExtensions(),
    content: {
      type: 'doc',
      content: [
        {
          type: 'blockGroup',
          content: [
            {
              type: 'blockContainer',
              attrs: { id: 'paragraph' },
              content: [
                {
                  type: 'paragraph',
                  attrs: { backgroundColor: 'default', textColor: 'default', textAlignment: 'left' },
                  content: [{ type: 'text', text: 'Open the AI menu' }],
                },
              ],
            },
          ],
        },
      ],
    },
  });
}

function firstParagraphPosition(currentEditor: Editor): number {
  let result = -1;
  currentEditor.state.doc.descendants((node, pos) => {
    if (result === -1 && node.type.name === 'paragraph') {
      result = pos;
    }
  });
  if (result < 0) {
    throw new Error('Test paragraph is missing');
  }
  return result;
}

function ControllerHarness({
  currentEditor,
  allowGenerate = true,
}: {
  currentEditor: Editor;
  allowGenerate?: boolean;
}) {
  const controller = useTiptapAIController({ editor: currentEditor, allowGenerate });
  return (
    <>
      <button type="button" data-testid="open-ai-current" onClick={() => controller.open()}>
        Open current AI context
      </button>
      <button
        type="button"
        data-testid="open-ai-selection"
        onClick={() => controller.open(resolveTiptapAIContext(currentEditor))}
      >
        Open selection AI context
      </button>
      <TiptapAIAssistantSurface controller={controller} client={assistantClient} target={target} />
    </>
  );
}

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  element?.remove();
  element = null;
  editor?.destroy();
  editor = null;
  document.querySelectorAll('.ProseMirror').forEach((node) => node.parentElement?.remove());
});

describe('TiptapAIAssistant', () => {
  it('opens on Mod-J and closes when the captured selection becomes stale', () => {
    const currentEditor = createEditor();
    editor = currentEditor;
    element = document.createElement('div');
    document.body.append(element);
    root = createRoot(element);

    act(() => {
      root?.render(<TiptapAIAssistant editor={currentEditor} client={assistantClient} target={target} />);
    });
    act(() => {
      currentEditor.view.dom.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'j', ctrlKey: true, bubbles: true, cancelable: true }),
      );
    });
    expect(document.querySelector('[data-testid="tiptap-ai-menu"]')).not.toBeNull();

    act(() => {
      const paragraph = firstParagraphPosition(currentEditor);
      currentEditor.view.dispatch(
        currentEditor.state.tr.setSelection(
          TextSelection.create(currentEditor.state.doc, paragraph + 1, paragraph + 2),
        ),
      );
    });
    expect(document.querySelector('[data-testid="tiptap-ai-menu"]')).toBeNull();
  });

  it('does not open for a non-editable editor', () => {
    const currentEditor = createEditor();
    editor = currentEditor;
    currentEditor.setEditable(false);
    element = document.createElement('div');
    document.body.append(element);
    root = createRoot(element);

    act(() => {
      root?.render(<TiptapAIAssistant editor={currentEditor} client={assistantClient} target={target} />);
      currentEditor.view.dom.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'j', ctrlKey: true, bubbles: true, cancelable: true }),
      );
    });

    expect(document.querySelector('[data-testid="tiptap-ai-menu"]')).toBeNull();
  });

  it('uses the same typed controller for current and supplied selection contexts', () => {
    const currentEditor = createEditor();
    editor = currentEditor;
    element = document.createElement('div');
    document.body.append(element);
    root = createRoot(element);

    act(() => {
      root?.render(<ControllerHarness currentEditor={currentEditor} />);
    });
    act(() => {
      document.querySelector<HTMLButtonElement>('[data-testid="open-ai-current"]')?.click();
    });
    expect(document.querySelector('[data-testid="tiptap-ai-menu"]')).not.toBeNull();

    act(() => {
      document.querySelector<HTMLButtonElement>('[data-testid="tiptap-ai-menu"]')?.click();
      document.querySelector<HTMLButtonElement>('[data-testid="open-ai-selection"]')?.click();
    });
    expect(document.querySelector('[data-testid="tiptap-ai-menu"]')).not.toBeNull();
  });

  it('allows locale-owned selected text while refusing structure-generating context', () => {
    const currentEditor = createEditor();
    editor = currentEditor;
    element = document.createElement('div');
    document.body.append(element);
    root = createRoot(element);

    act(() => {
      root?.render(<ControllerHarness currentEditor={currentEditor} allowGenerate={false} />);
    });
    act(() => {
      document.querySelector<HTMLButtonElement>('[data-testid="open-ai-current"]')?.click();
    });
    expect(document.querySelector('[data-testid="tiptap-ai-menu"]')).toBeNull();

    act(() => {
      const paragraph = firstParagraphPosition(currentEditor);
      currentEditor.view.dispatch(
        currentEditor.state.tr.setSelection(
          TextSelection.create(currentEditor.state.doc, paragraph + 1, paragraph + 4),
        ),
      );
      document.querySelector<HTMLButtonElement>('[data-testid="open-ai-selection"]')?.click();
    });
    expect(document.querySelector('[data-testid="tiptap-ai-menu"]')).not.toBeNull();
  });
});
