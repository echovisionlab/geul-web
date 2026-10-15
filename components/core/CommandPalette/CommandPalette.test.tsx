// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { I18nProvider, RouterProvider } from 'react-aria-components';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CommandPalette, CommandPaletteResults, type CommandPaletteItem } from './CommandPalette';
let host: HTMLDivElement;
let root: Root;
const items: CommandPaletteItem[] = [
  { id: 'one', label: 'First post', href: '/posts/one' },
  { id: 'two', label: 'Second post', href: '/posts/two' },
];
beforeEach(() => {
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});
async function render(results = items) {
  const close = vi.fn(),
    navigate = vi.fn(),
    change = vi.fn();
  await act(async () =>
    root.render(
      <I18nProvider locale="en">
        <RouterProvider navigate={navigate}>
          <CommandPalette
            opened
            onClose={close}
            title="Search posts"
            closeLabel="Close"
            placeholder="Search posts"
            query=""
            onQueryChange={change}
          >
            <CommandPaletteResults items={results} label="Results" emptyLabel="No results" />
          </CommandPalette>
        </RouterProvider>
      </I18nProvider>,
    ),
  );
  return { close, navigate, change };
}
describe('Command palette navigation', () => {
  it('keeps virtual focus in search while ArrowDown and Enter activate a result', async () => {
    const { close, navigate } = await render();
    const input = document.querySelector<HTMLInputElement>('input[placeholder="Search posts"]')!;
    expect(document.activeElement).toBe(input);
    await act(async () => {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
      input.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowDown', bubbles: true }));
    });
    expect(document.activeElement).toBe(input);
    expect(input.getAttribute('aria-activedescendant')).toBeTruthy();
    await act(async () => {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      input.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', bubbles: true }));
    });
    expect(navigate).toHaveBeenCalled();
    expect(close).toHaveBeenCalledOnce();
  });
  it('renders the empty async collection and closes on Escape', async () => {
    const { close } = await render([]);
    expect(document.body.textContent).toContain('No results');
    const input = document.querySelector<HTMLInputElement>('input[placeholder="Search posts"]')!;
    await act(async () => input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    expect(close).toHaveBeenCalledOnce();
  });
});
