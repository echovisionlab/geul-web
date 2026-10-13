// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { I18nProvider } from 'react-aria-components';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { IconButton } from '../IconButton';

// An open request made before the menu surface loads must not open the menu (and move focus into
// it) once the surface arrives if the user dismissed it or moved on meanwhile.

let container: HTMLDivElement;
let root: Root;
let releaseSurface: () => void;

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

beforeEach(() => {
  vi.resetModules();
  const gate = Promise.withResolvers<void>();
  releaseSurface = gate.resolve;
  // The surface chunk arrives when the test releases it.
  vi.doMock('./DropdownMenu', async (importOriginal) => {
    await gate.promise;
    return importOriginal();
  });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  document.body.replaceChildren();
  vi.doUnmock('./DropdownMenu');
});

async function renderMenu() {
  const { OnDemandDropdownMenu, preloadDropdownMenu } = await import('./OnDemandDropdownMenu');
  act(() =>
    root.render(
      <I18nProvider locale="en-US">
        <button type="button">Elsewhere</button>
        <OnDemandDropdownMenu portal={false}>
          <OnDemandDropdownMenu.Target>
            <IconButton size="chrome" aria-label="Language">
              <span aria-hidden>A</span>
            </IconButton>
          </OnDemandDropdownMenu.Target>
          <OnDemandDropdownMenu.Dropdown>
            <OnDemandDropdownMenu.Item>English</OnDemandDropdownMenu.Item>
          </OnDemandDropdownMenu.Dropdown>
        </OnDemandDropdownMenu>
      </I18nProvider>,
    ),
  );
  const trigger = container.querySelector<HTMLButtonElement>('button[aria-label="Language"]')!;
  const elsewhere = [...container.querySelectorAll('button')].find((b) => b.textContent === 'Elsewhere')!;
  return {
    trigger,
    elsewhere,
    async load() {
      releaseSurface();
      await act(() => preloadDropdownMenu());
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
    },
  };
}

async function openWithKeyboard(trigger: HTMLElement) {
  await act(async () => {
    trigger.focus();
    trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    trigger.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowDown', bubbles: true }));
  });
  expect(trigger.getAttribute('aria-expanded')).toBe('true');
  expect(container.querySelector('[role="menu"]')).toBeNull();
}

it('cancels a keyboard open request with Escape before the surface loads', async () => {
  const { trigger, load } = await renderMenu();
  await openWithKeyboard(trigger);
  await act(async () => {
    trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  });
  expect(trigger.getAttribute('aria-expanded')).toBe('false');
  await load();
  expect(container.querySelector('[role="menu"]')).toBeNull();
  expect(trigger).toHaveFocus();
}, 20000);

it('cancels an open request when focus leaves the trigger before the surface loads', async () => {
  const { trigger, elsewhere, load } = await renderMenu();
  await openWithKeyboard(trigger);
  act(() => elsewhere.focus());
  await load();
  expect(container.querySelector('[role="menu"]')).toBeNull();
  expect(trigger.getAttribute('aria-expanded')).toBe('false');
  expect(elsewhere).toHaveFocus();
}, 20000);

it('cancels a pressed open request on an outside press before the surface loads', async () => {
  const { trigger, load } = await renderMenu();
  act(() => trigger.click());
  expect(trigger.getAttribute('aria-expanded')).toBe('true');
  act(() => {
    document.body.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
  });
  await load();
  expect(container.querySelector('[role="menu"]')).toBeNull();
  expect(trigger.getAttribute('aria-expanded')).toBe('false');
}, 20000);

it('opens a request that is still valid once the surface loads', async () => {
  const { trigger, load } = await renderMenu();
  await openWithKeyboard(trigger);
  await load();
  expect(container.querySelector('[role="menu"]')).not.toBeNull();
  await vi.waitFor(() => expect(document.activeElement?.textContent).toBe('English'));
}, 20000);
