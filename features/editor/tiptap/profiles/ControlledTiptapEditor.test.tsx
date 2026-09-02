// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { Editor, JSONContent } from '@tiptap/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  WireBlockContainer,
  WireBlockGroup,
  WireDocument,
  WireHardBreak,
  WireParagraph,
  WireText,
} from '../wire-schema';
import { ControlledTiptapEditor } from './ControlledTiptapEditor';

let root: Root | null = null;
let host: HTMLDivElement | null = null;

afterEach(async () => {
  await act(async () => {
    root?.unmount();
    await new Promise((resolve) => setTimeout(resolve, 2));
  });
  host?.remove();
  root = null;
  host = null;
});

function parseValue(value: string): JSONContent {
  return {
    type: 'doc',
    content: [
      {
        type: 'blockGroup',
        content: [
          {
            type: 'blockContainer',
            content: [{ type: 'paragraph', content: value ? [{ type: 'text', text: value }] : [] }],
          },
        ],
      },
    ],
  };
}

function serializeValue(document: JSONContent): string {
  return document.content?.[0]?.content?.[0]?.content?.[0]?.content?.[0]?.text ?? '';
}

const extensions = [WireDocument, WireBlockGroup, WireBlockContainer, WireParagraph, WireText, WireHardBreak];

describe('ControlledTiptapEditor', () => {
  it('shares controlled-value synchronization without emitting external updates', async () => {
    const onChange = vi.fn();
    const mounted: { editor: Editor | null } = { editor: null };
    const render = (value: string) =>
      root?.render(
        <ControlledTiptapEditor
          value={value}
          extensions={extensions}
          parseValue={parseValue}
          serializeValue={serializeValue}
          onChange={onChange}
          onEditorReady={(nextEditor) => {
            mounted.editor = nextEditor;
          }}
          profile="test-copy"
        />,
      );

    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
    await act(async () => render('Initial'));

    expect(mounted.editor).not.toBeNull();
    expect(serializeValue(mounted.editor!.getJSON())).toBe('Initial');
    expect(host.querySelector('[data-profile="test-copy"]')).not.toBeNull();

    await act(async () => {
      mounted.editor?.commands.setContent(parseValue('Typed'));
    });
    expect(onChange).toHaveBeenLastCalledWith('Typed');

    onChange.mockClear();
    await act(async () => render('External'));
    expect(serializeValue(mounted.editor!.getJSON())).toBe('External');
    expect(onChange).not.toHaveBeenCalled();
  });
});
