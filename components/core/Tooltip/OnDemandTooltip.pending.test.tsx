// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { I18nProvider } from 'react-aria-components';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { IconButton } from '../IconButton';

// A hint whose focus ended before its surface loaded must not appear when the surface arrives.

let container: HTMLDivElement;
let root: Root;
let releaseSurface: () => void;

beforeEach(() => {
  vi.resetModules();
  const gate = Promise.withResolvers<void>();
  releaseSurface = gate.resolve;
  vi.doMock('./Tooltip', async (importOriginal) => {
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
  vi.doUnmock('./Tooltip');
});

async function renderHint() {
  const { OnDemandTooltip, preloadTooltip } = await import('./OnDemandTooltip');
  act(() =>
    root.render(
      <I18nProvider locale="en-US">
        <button type="button">Elsewhere</button>
        <OnDemandTooltip label="Search (Ctrl+K)" withinPortal={false}>
          <IconButton size="chrome" aria-label="Search">
            <span aria-hidden>S</span>
          </IconButton>
        </OnDemandTooltip>
      </I18nProvider>,
    ),
  );
  return {
    trigger: container.querySelector<HTMLButtonElement>('button[aria-label="Search"]')!,
    elsewhere: [...container.querySelectorAll('button')].find((b) => b.textContent === 'Elsewhere')!,
    async load() {
      releaseSurface();
      await act(() => preloadTooltip());
    },
  };
}

it('does not show a hint whose keyboard focus ended before the surface loaded', async () => {
  const { trigger, elsewhere, load } = await renderHint();
  // Keyboard focus shows a hint immediately (no open delay).
  await act(async () => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    trigger.focus();
  });
  act(() => elsewhere.focus());
  await load();
  expect(container.querySelector('[role="tooltip"]')).toBeNull();
  expect(trigger.hasAttribute('aria-describedby')).toBe(false);
}, 20000);

it('shows a hint that is still wanted once the surface loads', async () => {
  const { trigger, load } = await renderHint();
  await act(async () => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    trigger.focus();
  });
  await load();
  expect(container.querySelector('[role="tooltip"]')?.textContent).toBe('Search (Ctrl+K)');
}, 20000);
