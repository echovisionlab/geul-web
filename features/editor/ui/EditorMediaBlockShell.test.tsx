// @vitest-environment jsdom

import { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { EditableMediaCaption, EditorMediaBlockFrame, EditorMediaBlockSelector } from './EditorMediaBlockShell';

vi.mock('./preventNativeBlockDrag', () => ({
  preventNativeBlockDrag: vi.fn(),
}));

describe('EditorMediaBlockShell', () => {
  it('keeps keyboard selector focus distinct from persistent block selection', () => {
    function Example() {
      const [selected, setSelected] = useState(false);
      return (
        <>
          <EditorMediaBlockFrame displaySize={100} allowResize={false} selected={selected}>
            <EditorMediaBlockSelector label="Code block" enabled onSelect={() => setSelected(true)} />
          </EditorMediaBlockFrame>
          <button type="button">Next control</button>
        </>
      );
    }
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    try {
      act(() => root.render(<Example />));
      const selector = container.querySelector<HTMLButtonElement>('[data-editor-block-selector]')!;
      const frame = selector.parentElement!;
      expect(selector.tabIndex).toBe(0);
      act(() => selector.focus());
      expect(document.activeElement).toBe(selector);
      expect(frame.getAttribute('data-selected')).toBe('true');
      expect(frame.matches(':has(> button:focus-visible)')).toBe(true);
      act(() => container.querySelectorAll<HTMLButtonElement>('button')[1]!.focus());
      expect(frame.matches(':has(> button:focus-visible)')).toBe(false);
      expect(frame.getAttribute('data-selected')).toBe('true');
    } finally {
      act(() => root.unmount());
      container.remove();
    }
  });

  it('owns the common independent-block selection outline', () => {
    const css = readFileSync(resolve(process.cwd(), 'features/editor/ui/EditorMediaBlockShell.module.css'), 'utf8');

    expect(css).toContain(".frame[data-selected='true'] {");
    expect(css).toContain('outline: var(--geul-border-thin) solid var(--geul-action-primary);');
    expect(css).toContain('outline-offset: var(--geul-border-focus);');
  });

  it('suppresses static selection only for selected opted-in frames while preserving form controls', () => {
    const css = readFileSync(resolve(process.cwd(), 'features/editor/ui/EditorMediaBlockShell.module.css'), 'utf8');
    const normalizedCss = css.replace(/\s+/gu, ' ');
    const selectedSuppressedFrame = ".frame[data-selected='true'][data-suppress-static-text-selection='true']";

    expect(normalizedCss).toContain(`${selectedSuppressedFrame} { -webkit-user-select: none; user-select: none; }`);
    expect(normalizedCss).toContain(
      `${selectedSuppressedFrame} :is(input, textarea, [contenteditable='true']) { -webkit-user-select: text; user-select: text; }`,
    );
    expect(normalizedCss).toContain(
      `${selectedSuppressedFrame} select { -webkit-user-select: auto; user-select: auto; }`,
    );
  });

  it('projects editor selection and resize state into Core handle visibility', () => {
    const html = renderToStaticMarkup(
      <EditorMediaBlockFrame displaySize={60} allowResize selected isResizing>
        <div>content</div>
      </EditorMediaBlockFrame>,
    );

    expect(html).toContain('data-selected="true"');
    expect(html).toContain('data-resizing="true"');
    expect(html).toContain('data-geul-resize-placement="media-edge"');
    expect(html).toContain('data-geul-resize-visibility="active"');
    expect(html).not.toContain('data-show-resize-handles');
    const resting = renderToStaticMarkup(
      <EditorMediaBlockFrame displaySize={60} allowResize>
        <div>content</div>
      </EditorMediaBlockFrame>,
    );
    expect(resting).toContain('data-geul-resize-visibility="on-interaction"');
  });

  it('marks only opted-in media frames as static-text selection boundaries', () => {
    const suppressed = renderToStaticMarkup(
      <EditorMediaBlockFrame displaySize={100} allowResize={false} suppressStaticTextSelection>
        <input aria-label="Editable title" />
        <span>Static metadata</span>
      </EditorMediaBlockFrame>,
    );
    const regular = renderToStaticMarkup(
      <EditorMediaBlockFrame displaySize={100} allowResize={false}>
        <span>Regular content</span>
      </EditorMediaBlockFrame>,
    );

    expect(suppressed).toContain('data-suppress-static-text-selection="true"');
    expect(regular).not.toContain('data-suppress-static-text-selection');
  });

  it('shows the empty caption label only when the caption is editable', () => {
    const editable = renderToStaticMarkup(
      <EditableMediaCaption
        label="Caption"
        value=""
        isEditing={false}
        isEditable
        placeholder="Add a caption..."
        emptyLabel="Click to add caption"
        onActivate={() => {}}
        onChange={() => {}}
        onBlur={() => {}}
        onKeyDown={() => {}}
      />,
    );
    const readonly = renderToStaticMarkup(
      <EditableMediaCaption
        label="Caption"
        value=""
        isEditing={false}
        isEditable={false}
        placeholder="Add a caption..."
        emptyLabel="Click to add caption"
        onActivate={() => {}}
        onChange={() => {}}
        onBlur={() => {}}
        onKeyDown={() => {}}
      />,
    );
    const editing = renderToStaticMarkup(
      <EditableMediaCaption
        label="Caption"
        value="Caption"
        isEditing
        isEditable
        placeholder="Add a caption..."
        emptyLabel="Click to add caption"
        onActivate={() => {}}
        onChange={() => {}}
        onBlur={() => {}}
        onKeyDown={() => {}}
      />,
    );

    expect(editable).toContain('Click to add caption');
    expect(editable).not.toContain('data-editor-media-caption');
    expect(editing).toContain('data-editor-media-caption=""');
    expect(editing).toContain('aria-label="Caption"');
    expect(editable).toContain('<button');
    expect(readonly).toBe('');
  });
});
