// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { EditorSnapshotHandoff } from './EditorSnapshotHandoff';

const snapshot = <div data-id="block">SSR revision A</div>;

describe('snapshot handoff', () => {
  it('paints the body in server HTML before the room or editor exists', () => {
    const html = renderToStaticMarkup(
      <EditorSnapshotHandoff snapshot={snapshot} ready={false} editable={false}>
        <div contentEditable>revision B</div>
      </EditorSnapshotHandoff>,
    );
    expect(html).toContain('SSR revision A');
    expect(html).not.toContain('revision B');
    expect(html).not.toContain('contenteditable="true"');
  });

  it('keeps the snapshot while the lazy view mounts, then accepts a different live revision', async () => {
    const host = document.createElement('div');
    document.body.append(host);
    const root = createRoot(host);
    const render = (ready: boolean, editor: boolean) =>
      root.render(
        <EditorSnapshotHandoff snapshot={snapshot} ready={ready} editable>
          {editor ? (
            <div className="ProseMirror" contentEditable suppressContentEditableWarning>
              revision B
            </div>
          ) : null}
        </EditorSnapshotHandoff>,
      );
    await act(async () => render(false, false));
    host.scrollTop = 80;
    await act(async () => {
      host.querySelector('[data-id]')!.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 0 }));
      render(true, false);
    });
    expect(host.textContent).toContain('SSR revision A');
    await act(async () => render(true, true));
    expect(host.textContent).toBe('revision B');
    expect(host.scrollTop).toBe(80);
    expect(document.activeElement).toBe(host.querySelector('.ProseMirror'));
    await act(async () => root.unmount());
    host.remove();
  });

  it('does not focus a read-only room and handles an empty Page body', async () => {
    const host = document.createElement('div');
    document.body.append(host);
    const root = createRoot(host);
    await act(async () =>
      root.render(
        <EditorSnapshotHandoff page snapshot={snapshot} ready editable={false}>
          <div data-page-body-mounted>read only</div>
        </EditorSnapshotHandoff>,
      ),
    );
    expect(host.textContent).toBe('read only');
    expect(document.activeElement).not.toBe(host.firstElementChild);
    await act(async () => root.unmount());
    host.remove();
  });
});
it('waits for every Page rich-text surface, including a delayed second editor', async () => {
  const host = document.createElement('div');
  const root = createRoot(host);
  const render = (second: boolean) =>
    root.render(
      <EditorSnapshotHandoff page snapshot={snapshot} ready editable>
        <div data-page-body-mounted>
          <div data-room-rich-text>
            <div className="ProseMirror">first</div>
          </div>
          <div data-room-rich-text>{second ? <div className="ProseMirror">second</div> : null}</div>
        </div>
      </EditorSnapshotHandoff>,
    );
  await act(async () => render(false));
  expect(host.textContent).toContain('SSR revision A');
  await act(async () => render(true));
  expect(host.textContent).toBe('firstsecond');
  await act(async () => root.unmount());
});
