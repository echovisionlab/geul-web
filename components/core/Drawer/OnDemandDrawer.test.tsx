// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { DrawerProps } from './Drawer';

// A drawer closed (or dismissed with Escape) before its surface loaded must not open when the
// surface arrives.

let container: HTMLDivElement;
let root: Root;
let releaseSurface: () => void;

beforeEach(() => {
  vi.resetModules();
  const gate = Promise.withResolvers<void>();
  releaseSurface = gate.resolve;
  vi.doMock('./Drawer', async (importOriginal) => {
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
  vi.doUnmock('./Drawer');
});

async function setup() {
  const { OnDemandDrawer, preloadDrawer } = await import('./OnDemandDrawer');
  const trigger = document.createElement('button');
  trigger.textContent = 'Menu';
  document.body.append(trigger);
  trigger.focus();
  const onClose = vi.fn();
  const render = (props: Partial<DrawerProps>) =>
    act(() =>
      root.render(<OnDemandDrawer opened onClose={onClose} title="Navigation" closeLabel="Close" {...props} />),
    );
  return {
    trigger,
    onClose,
    render,
    async load() {
      releaseSurface();
      await act(() => preloadDrawer());
    },
  };
}

it('stays closed when it is closed before the surface loads', async () => {
  const { trigger, render, load } = await setup();
  render({ opened: true });
  render({ opened: false });
  await load();
  render({ opened: false });
  expect(document.querySelector('[role="dialog"]')).toBeNull();
  expect(trigger).toHaveFocus();
  trigger.remove();
}, 20000);

it('asks to close a dismissible drawer when Escape is pressed before the surface loads', async () => {
  const { trigger, onClose, render } = await setup();
  render({ opened: true });
  act(() => {
    trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  });
  expect(onClose).toHaveBeenCalledOnce();
  trigger.remove();
});

it('keeps a non-dismissible drawer request on Escape', async () => {
  const { trigger, onClose, render } = await setup();
  render({ opened: true, closePolicy: 'non-dismissible' });
  act(() => {
    trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  });
  expect(onClose).not.toHaveBeenCalled();
  trigger.remove();
});
