// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { DesignSystemProvider } from '@/lib/providers/DesignSystemProvider';
import enMessages from '@/messages/en.json';
import { EditorSelectionPreview, ContextualMenuPreview } from './EditorMenusPreview';
let root: Root, host: HTMLDivElement;
beforeEach(() => {
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  Object.defineProperty(Range.prototype, 'getBoundingClientRect', {
    configurable: true,
    value: () => host.getBoundingClientRect(),
  });
  Object.defineProperty(Range.prototype, 'getClientRects', { configurable: true, value: () => [] });
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});
async function mount(node: React.ReactNode) {
  await act(async () =>
    root.render(
      <DesignSystemProvider locale="en" forceColorScheme="light">
        <NextIntlClientProvider locale="en" messages={enMessages}>
          {node}
        </NextIntlClientProvider>
      </DesignSystemProvider>,
    ),
  );
}
describe('Production editor menu adapters', () => {
  it('inserts a heading from the actual slash menu into the wire document', async () => {
    await mount(<EditorSelectionPreview kind="slash" />);
    await vi.waitFor(() => expect(host.querySelector('[role="listbox"]')).not.toBeNull());
    const item = host.querySelector<HTMLElement>('[data-testid="tiptap-slash-item-heading"]')!;
    expect(item).not.toBeNull();
    await act(async () => item.click());
    expect(host.querySelector('[role="listbox"]')).toBeNull();
    expect(host.querySelector('[data-content-type="heading"]')).not.toBeNull();
  });
  it('changes real formatting commands rather than only preview button state', async () => {
    await mount(<EditorSelectionPreview />);
    const bold = host.querySelector<HTMLButtonElement>(
      `button[aria-label="${enMessages.editorCommon.editor.formatting.bold}"]`,
    )!;
    expect(bold).not.toBeNull();
    await act(async () => bold.click());
    expect(host.querySelector('.tiptap strong')).not.toBeNull();
  });
  it('updates contextual alignment through the actual map view callback', async () => {
    await mount(<ContextualMenuPreview />);
    await act(async () =>
      host
        .querySelector<HTMLButtonElement>(
          `button[aria-label="${enMessages.editorCommon.editor.formatting.alignCenter}"]`,
        )!
        .click(),
    );
    expect(host.querySelector<HTMLElement>('[data-testid="contextual-block-preview"]')?.style.textAlign).toBe('center');
  });
  it('focuses the caption field and removes the selected map block', async () => {
    await mount(<ContextualMenuPreview />);
    await act(async () =>
      host.querySelector<HTMLButtonElement>(`button[aria-label="${enMessages.common.labels.caption}"]`)!.click(),
    );
    expect(document.activeElement).toBe(host.querySelector('input'));
    await act(async () =>
      host.querySelector<HTMLButtonElement>(`button[aria-label="${enMessages.common.actions.delete}"]`)!.click(),
    );
    expect(host.querySelector('[data-testid="contextual-block-preview"]')).toBeNull();
    expect(host.querySelector('[data-testid="tiptap-map-menu"]')).toBeNull();
  });
});
