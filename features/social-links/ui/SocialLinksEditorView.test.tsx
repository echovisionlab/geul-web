// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TestProviders } from '@/test/TestProviders';
import { SocialLinksEditorView, type SocialLinksEditorViewProps } from './SocialLinksEditorView';
vi.mock('./SocialLinkInputView', () => ({ SocialLinkInputView: () => <span>Link input</span> }));
let host: HTMLDivElement;
let root: Root;
afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
});
function render(disabled = false) {
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  const move = vi.fn();
  const props: SocialLinksEditorViewProps = {
    items: ['first', 'second', 'third'].map((key) => ({
      key,
      platform: '',
      value: '',
      selectedPlatform: null,
      selectedValuePlaceholder: null,
    })),
    platformOptions: [],
    labels: {
      fieldLabel: 'Social links',
      addLink: 'Add',
      reorderLink: 'Reorder',
      platformPlaceholder: 'Platform',
      valuePlaceholder: 'URL',
      remove: 'Remove',
    },
    canAddMore: true,
    disabled,
    onAddLink: vi.fn(),
    onRemoveLink: vi.fn(),
    onPlatformChange: vi.fn(),
    onValueChange: vi.fn(),
    onValueBlur: vi.fn(),
    onMoveLink: move,
  };
  act(() =>
    root.render(
      <TestProviders>
        <SocialLinksEditorView {...props} />
      </TestProviders>,
    ),
  );
  return { move, handles: Array.from(host.querySelectorAll<HTMLButtonElement>('button[aria-label="Reorder"]')) };
}
describe('social link ordering control', () => {
  it('uses focusable shared drag controls and reorders with arrow keys', () => {
    const { move, handles } = render();
    expect(handles).toHaveLength(3);
    expect(handles[1].getAttribute('data-interaction')).toBe('drag-handle');
    act(() =>
      handles[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, cancelable: true })),
    );
    expect(move).toHaveBeenLastCalledWith(1, 0);
    act(() =>
      handles[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true })),
    );
    expect(move).toHaveBeenLastCalledWith(1, 2);
  });
  it('keeps the first and last row inside the list', () => {
    const { move, handles } = render();
    act(() => handles[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true })));
    act(() => handles[2].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })));
    expect(move).not.toHaveBeenCalled();
  });
  it('disables reordering together with the input collection', () => {
    const { move, handles } = render(true);
    expect(handles.every((handle) => handle.disabled)).toBe(true);
    act(() => handles[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true })));
    expect(move).not.toHaveBeenCalled();
  });
});
