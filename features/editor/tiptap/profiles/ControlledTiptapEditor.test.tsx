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

vi.mock('next-intl', () => ({ useLocale: () => 'en', useTranslations: () => (key: string) => key }));

let root: Root | null = null;
let host: HTMLDivElement | null = null;

afterEach(() => {
  // Tiptap destroys an unmounted editor from a short timer; run it instead of waiting for it.
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  try {
    act(() => root?.unmount());
    vi.runOnlyPendingTimers();
  } finally {
    vi.useRealTimers();
  }
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
  it('connects field identity and description to the focused editing surface and updates them without remounting', async () => {
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
    const onChange = vi.fn();
    const render = (contentId?: string, accessibleDescriptionId?: string, accessibleLabel = 'Scene description') =>
      root?.render(
        <>
          <p id="scene-help">Markdown for this scene.</p>
          <p id="translation-help">Description for the selected language.</p>
          <ControlledTiptapEditor
            value="Retained scene copy"
            accessibleLabel={accessibleLabel}
            contentId={contentId}
            accessibleDescriptionId={accessibleDescriptionId}
            extensions={extensions}
            parseValue={parseValue}
            serializeValue={serializeValue}
            onChange={onChange}
            profile="test-field-copy"
          />
        </>,
      );
    await act(async () => render('scene-copy', 'scene-help'));
    const surface = host.querySelector<HTMLElement>('[role="textbox"]')!;
    expect(document.getElementById('scene-copy')).toBe(surface);
    expect(surface).toHaveAccessibleName('Scene description');
    expect(surface).toHaveAccessibleDescription('Markdown for this scene.');
    await act(async () => surface.focus());
    expect(surface).toHaveFocus();

    await act(async () => render('translated-copy', 'translation-help', 'Translated scene description'));
    expect(document.getElementById('scene-copy')).toBeNull();
    expect(document.getElementById('translated-copy')).toBe(surface);
    expect(surface).toHaveFocus();
    expect(surface).toHaveAccessibleName('Translated scene description');
    expect(surface).toHaveAccessibleDescription('Description for the selected language.');
    expect(surface.textContent).toBe('Retained scene copy');
    expect(onChange).not.toHaveBeenCalled();

    await act(async () => render());
    expect(surface).not.toHaveAttribute('id');
    expect(surface).not.toHaveAttribute('aria-describedby');
    expect(surface).toHaveAccessibleName('Scene description');
    expect(surface).toHaveFocus();
    expect(surface.textContent).toBe('Retained scene copy');
  });

  it('shares controlled-value synchronization without emitting external updates', async () => {
    const onChange = vi.fn();
    const mounted: { editor: Editor | null } = { editor: null };
    const render = (value: string, accessibleLabel = 'Scene description', contentLanguage = 'ko') =>
      root?.render(
        <ControlledTiptapEditor
          accessibleLabel={accessibleLabel}
          contentLanguage={contentLanguage}
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
    expect(mounted.editor!.view.dom).toHaveAttribute('role', 'textbox');
    expect(mounted.editor!.view.dom).toHaveAttribute('aria-label', 'Scene description');
    expect(mounted.editor!.view.dom).toHaveAttribute('aria-multiline', 'true');
    expect(mounted.editor!.view.dom).toHaveAttribute('lang', 'ko');

    await act(async () => {
      mounted.editor?.commands.setContent(parseValue('Typed'));
    });
    expect(onChange).toHaveBeenLastCalledWith('Typed');

    onChange.mockClear();
    await act(async () => render('External'));
    expect(serializeValue(mounted.editor!.getJSON())).toBe('External');
    expect(onChange).not.toHaveBeenCalled();

    const originalEditor = mounted.editor;
    await act(async () => render('External', 'Description du décor', 'fr'));
    expect(mounted.editor).toBe(originalEditor);
    expect(mounted.editor!.view.dom).toHaveAttribute('aria-label', 'Description du décor');
    expect(mounted.editor!.view.dom).toHaveAttribute('lang', 'fr');
    expect(serializeValue(mounted.editor!.getJSON())).toBe('External');
    expect(onChange).not.toHaveBeenCalled();
  });
});
