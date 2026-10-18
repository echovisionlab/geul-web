// @vitest-environment jsdom

import { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
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
          <EditorMediaBlockFrame widthPercent={100} allowResize={false} selected={selected}>
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
