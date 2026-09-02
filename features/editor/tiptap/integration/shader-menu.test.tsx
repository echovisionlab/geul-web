// @vitest-environment jsdom

import { act, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { MantineProvider } from '@mantine/core';
import { Editor } from '@tiptap/core';
import { NodeSelection } from '@tiptap/pm/state';
import { describe, expect, it, vi } from 'vitest';
import { canShowSelectionBubbleMenu } from '../menus';
import {
  createExecutableSelectionMenuRegistry,
  TiptapExecutableSelectionBubbleMenu,
  resolveSelectedExecutableBlock,
  type ExecutableSelectionMenuBinding,
} from '../menus/executable';
import { createShaderExtension, DEFAULT_SHADER_PROGRAM, SHADER_STAGE_DEFINITIONS } from '../shader';
import { createTiptapWireExtensions } from '../wire-schema';

vi.mock('@tiptap/react/menus', () => ({
  BubbleMenu: ({ children }: { children: ReactNode }) => children,
}));

vi.mock('@/features/editor/tiptap/code-editor', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/editor/tiptap/code-editor')>()),
  MonacoSourceEditor: () => null,
}));

const labels = {
  menu: 'Shader',
  edit: 'Edit',
  source: 'Source',
  preview: 'Preview',
  run: 'Run',
  stop: 'Stop',
  restart: 'Restart',
  deleteBlock: 'Delete',
  alignment: 'Alignment',
  alignLeft: 'Align left',
  alignCenter: 'Align center',
  alignRight: 'Align right',
};

function binding(): ExecutableSelectionMenuBinding {
  return {
    snapshot: {
      blockType: 'shader',
      mode: 'edit',
      running: false,
      textAlignment: 'left',
      labels,
    },
    commands: {
      setMode: vi.fn(),
      run: vi.fn(),
      stop: vi.fn(),
      restart: vi.fn(),
      setAlignment: vi.fn(),
      deleteBlock: vi.fn(),
    },
  };
}

function createShaderEditor() {
  const element = document.createElement('div');
  document.body.append(element);
  const editor = new Editor({
    element,
    extensions: [...createTiptapWireExtensions(), createShaderExtension()],
    content: {
      type: 'doc',
      content: [
        {
          type: 'blockGroup',
          content: [
            {
              type: 'blockContainer',
              attrs: { id: 'shader-menu-block' },
              content: [
                {
                  type: 'shader',
                  content: SHADER_STAGE_DEFINITIONS.map(([stage, nodeName]) => ({
                    type: nodeName,
                    ...(DEFAULT_SHADER_PROGRAM.sources[stage]
                      ? { content: [{ type: 'text', text: DEFAULT_SHADER_PROGRAM.sources[stage] }] }
                      : {}),
                  })),
                },
              ],
            },
          ],
        },
      ],
    },
  });
  editor.view.dispatch(editor.state.tr.setSelection(NodeSelection.create(editor.state.doc, 2)));
  return { editor, element };
}

describe('Shader selection menu integration', () => {
  it('routes an exact Shader NodeSelection only to the executable menu and dismisses it from both focus paths', async () => {
    const mounted = createShaderEditor();
    const registry = createExecutableSelectionMenuRegistry();
    registry.register('shader-menu-block', binding());

    expect(resolveSelectedExecutableBlock(mounted.editor)).toEqual({
      blockId: 'shader-menu-block',
      blockType: 'shader',
    });
    expect(canShowSelectionBubbleMenu(mounted.editor)).toBe(false);

    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <MantineProvider env="test">
          <TiptapExecutableSelectionBubbleMenu editor={mounted.editor} registry={registry} />
        </MantineProvider>,
      );
    });

    expect(container.querySelectorAll('[data-testid="tiptap-shader-menu"]')).toHaveLength(1);
    expect(container.querySelector('[data-testid="tiptap-selection-menu"]')).toBeNull();

    const selectionBeforeEscape = mounted.editor.state.selection.toJSON();
    const documentBeforeEscape = mounted.editor.state.doc.toJSON();
    await act(async () => {
      container
        .querySelector<HTMLElement>('[data-selection-toolbar-action]')
        ?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(container.querySelector('[data-testid="tiptap-shader-menu"]')).toBeNull();
    expect(mounted.editor.state.selection.toJSON()).toEqual(selectionBeforeEscape);
    expect(mounted.editor.state.doc.toJSON()).toEqual(documentBeforeEscape);
    expect(document.activeElement).toBe(mounted.editor.view.dom);

    await act(async () => {
      mounted.editor.view.dispatch(
        mounted.editor.state.tr.setSelection(NodeSelection.create(mounted.editor.state.doc, 1)),
      );
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    await act(async () => {
      mounted.editor.view.dispatch(
        mounted.editor.state.tr.setSelection(NodeSelection.create(mounted.editor.state.doc, 2)),
      );
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(container.querySelectorAll('[data-testid="tiptap-shader-menu"]')).toHaveLength(1);

    await act(async () => {
      mounted.editor.view.dom.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
      );
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(container.querySelector('[data-testid="tiptap-shader-menu"]')).toBeNull();
    expect(mounted.editor.state.selection.toJSON()).toEqual(selectionBeforeEscape);
    expect(mounted.editor.state.doc.toJSON()).toEqual(documentBeforeEscape);

    await act(async () => {
      mounted.editor.setEditable(false);
    });
    expect(container.querySelector('[data-testid="tiptap-shader-menu"]')).toBeNull();

    await act(async () => root.unmount());
    mounted.editor.destroy();
    mounted.element.remove();
    container.remove();
  });
});
