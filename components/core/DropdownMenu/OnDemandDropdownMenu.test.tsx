// @vitest-environment jsdom

import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { I18nProvider } from 'react-aria-components';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IconButton } from '../IconButton';
import { DropdownMenu } from './DropdownMenu';
import { OnDemandDropdownMenu, preloadDropdownMenu } from './OnDemandDropdownMenu';

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

Object.defineProperty(window, 'ResizeObserver', {
  configurable: true,
  writable: true,
  value: class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
});
Object.defineProperty(window.HTMLElement.prototype, 'scrollIntoView', {
  configurable: true,
  writable: true,
  value: vi.fn(),
});

type Menu = typeof DropdownMenu | typeof OnDemandDropdownMenu;
function languageMenu(Menu: Menu, onSelect = vi.fn()) {
  return (
    <I18nProvider locale="en-US">
      <Menu size="wide" placement="bottom-end" portal={false}>
        <Menu.Target>
          <IconButton size="chrome" aria-label="Language">
            <span aria-hidden>A</span>
          </IconButton>
        </Menu.Target>
        <Menu.Dropdown data-testid="menu">
          <Menu.Label>Languages</Menu.Label>
          <Menu.Item selected>English</Menu.Item>
          <Menu.Divider />
          <Menu.Item onClick={onSelect}>한국어</Menu.Item>
        </Menu.Dropdown>
      </Menu>
    </I18nProvider>
  );
}
const withoutIds = (html: string) => html.replace(/react-aria-_R_[A-Za-z0-9_]+_/g, 'ID');
function render(node: ReactNode) {
  act(() => root.render(node));
}
const trigger = () => container.querySelector<HTMLButtonElement>('button[aria-label="Language"]')!;

describe('OnDemandDropdownMenu', () => {
  // Runs first: the surface module has not been requested yet in this file.
  it('opens a menu pressed before its surface loaded, once it arrives, with focus moved into the menu', async () => {
    render(languageMenu(OnDemandDropdownMenu));
    expect(trigger().getAttribute('aria-expanded')).toBe('false');
    await act(async () => {
      trigger().focus();
      trigger().dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
      trigger().dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowDown', bubbles: true }));
    });
    expect(trigger().getAttribute('aria-expanded')).toBe('true');
    await act(() => preloadDropdownMenu());
    const menu = container.querySelector('[role="menu"]')!;
    expect(menu).not.toBeNull();
    expect(trigger().getAttribute('aria-controls')).toBe(menu.id);
    expect(menu.getAttribute('aria-labelledby')).toBe(trigger().id);
    await vi.waitFor(() => expect(document.activeElement?.textContent).toBe('English'));
  }, 20000);

  it('renders the same server markup as DropdownMenu', () => {
    expect(withoutIds(renderToString(languageMenu(OnDemandDropdownMenu)))).toBe(
      withoutIds(renderToString(languageMenu(DropdownMenu))),
    );
  });

  it.each([
    ['DropdownMenu', DropdownMenu],
    ['OnDemandDropdownMenu', OnDemandDropdownMenu],
  ] as const)('%s once open: sections, selection, item action, Escape and focus return', async (_name, Menu) => {
    const select = vi.fn();
    render(languageMenu(Menu, select));
    act(() => trigger().click());
    const menu = container.querySelector('[role="menu"]')!;
    expect(menu.querySelector('[role="group"]')).not.toBeNull();
    expect(menu.querySelector('[aria-current="true"]')?.textContent).toContain('English');
    act(() => [...menu.querySelectorAll<HTMLElement>('[role="menuitem"]')].at(-1)!.click());
    expect(select).toHaveBeenCalledOnce();
    await act(async () => {
      document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(container.querySelector('[role="menu"]')).toBeNull();
    await vi.waitFor(() => expect(trigger()).toHaveFocus());
  });
});
