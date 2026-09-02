// @vitest-environment jsdom

import { createRef } from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { EditableMediaCaption, EditorMediaBlockFrame } from './EditorMediaBlockShell';

vi.mock('./preventNativeBlockDrag', () => ({
  preventNativeBlockDrag: vi.fn(),
}));

describe('EditorMediaBlockShell', () => {
  it('owns the common independent-block selection outline', () => {
    const css = readFileSync(resolve(process.cwd(), 'features/editor/ui/EditorMediaBlockShell.module.css'), 'utf8');

    expect(css).toContain(".frame[data-selected='true'] {");
    expect(css).toContain('outline: 1px solid var(--mantine-primary-color-filled);');
    expect(css).toContain('outline-offset: 2px;');
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

  it('renders resize handles when resizing is enabled', () => {
    const html = renderToStaticMarkup(
      <EditorMediaBlockFrame
        containerRef={createRef<HTMLDivElement>()}
        widthPercent={60}
        margin="0 auto"
        allowResize
        resizeLeftLabel="너비 왼쪽"
        resizeRightLabel="너비 오른쪽"
      >
        <div>content</div>
      </EditorMediaBlockFrame>,
    );

    expect(html).toContain('data-resize-direction="left"');
    expect(html).toContain('data-resize-direction="right"');
    expect(html).toContain('width:60%');
    expect(html).toContain('margin:0 auto');
  });

  it('uses selected and resizing data attributes for editor-owned handle visibility', () => {
    const html = renderToStaticMarkup(
      <EditorMediaBlockFrame widthPercent={60} allowResize selected isResizing>
        <div>content</div>
      </EditorMediaBlockFrame>,
    );

    expect(html).toContain('data-selected="true"');
    expect(html).toContain('data-resizing="true"');
    expect(html).not.toContain('data-show-resize-handles');
  });

  it('marks only opted-in media frames as static-text selection boundaries', () => {
    const suppressed = renderToStaticMarkup(
      <EditorMediaBlockFrame widthPercent={100} allowResize={false} suppressStaticTextSelection>
        <input aria-label="Editable title" />
        <span>Static metadata</span>
      </EditorMediaBlockFrame>,
    );
    const regular = renderToStaticMarkup(
      <EditorMediaBlockFrame widthPercent={100} allowResize={false}>
        <span>Regular content</span>
      </EditorMediaBlockFrame>,
    );

    expect(suppressed).toContain('data-suppress-static-text-selection="true"');
    expect(regular).not.toContain('data-suppress-static-text-selection');
  });

  it('shows the empty caption label only when the caption is editable', () => {
    const editable = renderToStaticMarkup(
      <EditableMediaCaption
        className="caption"
        inputClassName="caption-input"
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
        className="caption"
        inputClassName="caption-input"
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
        className="caption"
        inputClassName="caption-input"
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
    expect(editing).toContain('data-editor-media-caption="true"');
    expect(readonly).toBe('');
  });
});
