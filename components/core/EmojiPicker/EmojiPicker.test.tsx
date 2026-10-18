// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EmojiPickerPanel } from './EmojiPicker';
afterEach(() => vi.restoreAllMocks());
describe('Core emoji collection', () => {
  it('exposes the unchanged empty-result copy as a status while retaining the search input', async () => {
    const host = document.createElement('div');
    document.body.append(host);
    const root = createRoot(host);
    try {
      await act(async () =>
        root.render(
          <EmojiPickerPanel
            title="Emoji"
            searchPlaceholder="Search"
            noResults="No results"
            query="missing"
            items={[]}
            onQueryChange={() => {}}
            onSelect={() => {}}
          />,
        ),
      );
      expect(host.querySelector('[role="status"]')?.textContent).toBe('No results');
      expect(host.querySelector('input')?.getAttribute('aria-label')).toBe('Search');
      expect(host.querySelector('[role="listbox"]')).toBeNull();
    } finally {
      await act(async () => root.unmount());
      host.remove();
    }
  });

  it('virtualizes a complete large collection and preserves actual option selection', async () => {
    const widthDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth');
    const heightDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientHeight');
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
      configurable: true,
      get() {
        return this.getAttribute('role') === 'listbox' ? 340 : 0;
      },
    });
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
      configurable: true,
      get() {
        return this.getAttribute('role') === 'listbox' ? 252 : 0;
      },
    });
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    const onSelect = vi.fn();
    const items = Array.from({ length: 2000 }, (_, index) => ({
      id: String(index),
      label: `Emoji ${index}`,
      value: '🔥',
    }));
    await act(async () =>
      root.render(
        <EmojiPickerPanel
          title="Emoji"
          searchPlaceholder="Search"
          noResults="No results"
          query=""
          items={items}
          onQueryChange={() => {}}
          onSelect={onSelect}
        />,
      ),
    );
    const options = container.querySelectorAll<HTMLElement>('[role="option"]');
    expect(options.length).toBeGreaterThan(0);
    expect(options.length).toBeLessThan(100);
    expect(options[0]?.getAttribute('aria-label')).toBe('Emoji 0');
    await act(async () => options[0]?.click());
    expect(onSelect).toHaveBeenCalledWith(items[0]);
    await act(async () => {
      options[0]?.focus();
      options[0]?.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true, cancelable: true }));
    });
    const lastOption = container.querySelector<HTMLElement>('[role="option"][aria-label="Emoji 1999"]');
    expect(lastOption).not.toBeNull();
    expect(document.activeElement).toBe(lastOption);
    await act(async () => lastOption?.click());
    expect(onSelect).toHaveBeenCalledWith(items.at(-1));
    expect(container.querySelectorAll('[role="option"]').length).toBeLessThan(100);
    await act(async () => root.unmount());
    container.remove();
    if (widthDescriptor) {
      Object.defineProperty(HTMLElement.prototype, 'clientWidth', widthDescriptor);
    } else {
      Reflect.deleteProperty(HTMLElement.prototype, 'clientWidth');
    }
    if (heightDescriptor) {
      Object.defineProperty(HTMLElement.prototype, 'clientHeight', heightDescriptor);
    } else {
      Reflect.deleteProperty(HTMLElement.prototype, 'clientHeight');
    }
  });
  it('activates compact items through a native pointer press', async () => {
    class TestPointerEvent extends MouseEvent {
      pointerType = 'mouse';
      pointerId = 1;
      width = 1;
      height = 1;
      isPrimary = true;
    }
    vi.stubGlobal('PointerEvent', TestPointerEvent);
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    const onSelect = vi.fn();
    const item = { id: 'rocket', label: ':rocket:', value: '🚀' };
    try {
      await act(async () => {
        root.render(
          <EmojiPickerPanel
            density="compact"
            title="Emoji"
            searchPlaceholder="Search"
            noResults="None"
            query="rocket"
            items={[item]}
            onQueryChange={() => {}}
            onSelect={onSelect}
          />,
        );
      });
      const option = container.querySelector<HTMLElement>('[role="option"]')!;
      await act(async () => {
        option.dispatchEvent(
          new TestPointerEvent('pointerdown', { bubbles: true, cancelable: true, button: 0, clientX: 1, clientY: 1 }),
        );
        option.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0, detail: 1 }));
        option.focus();
      });
      await act(async () => {
        option.dispatchEvent(
          new TestPointerEvent('pointerup', { bubbles: true, cancelable: true, button: 0, clientX: 1, clientY: 1 }),
        );
        option.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, button: 0, detail: 1 }));
        option.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, detail: 1 }));
      });
      expect(onSelect).toHaveBeenCalledExactlyOnceWith(item);
    } finally {
      await act(async () => root.unmount());
      container.remove();
      vi.unstubAllGlobals();
    }
  });
});
