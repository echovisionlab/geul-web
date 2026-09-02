// @vitest-environment jsdom

import { act, useState, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MantineProvider } from '@mantine/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Popover, type PopoverSize } from './Popover';

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

function renderPopover(node: ReactNode, env: 'default' | 'test' = 'test') {
  act(() => {
    root.render(<MantineProvider env={env}>{node}</MantineProvider>);
  });
}

describe('Popover', () => {
  it('exposes the required compound API', () => {
    expect(Popover.Target).toBeDefined();
    expect(Popover.Dropdown).toBeDefined();
  });

  it('opens and closes through the uncontrolled target interaction', () => {
    renderPopover(
      <Popover portal={false}>
        <Popover.Target>
          <button type="button">Open details</button>
        </Popover.Target>
        <Popover.Dropdown>Popover details</Popover.Dropdown>
      </Popover>,
    );

    const target = container.querySelector<HTMLButtonElement>('button');
    expect(target?.getAttribute('aria-expanded')).toBe('false');
    expect(container.querySelector('[role="dialog"]')).toBeNull();

    act(() => target?.click());

    expect(target?.getAttribute('aria-expanded')).toBe('true');
    expect(container.querySelector('[role="dialog"]')?.textContent).toContain('Popover details');

    act(() => target?.click());

    expect(target?.getAttribute('aria-expanded')).toBe('false');
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it('reports controlled dismissal through semantic state callbacks', () => {
    const onOpenChange = vi.fn();
    const onClose = vi.fn();

    function ControlledPopover() {
      const [open, setOpen] = useState(true);

      return (
        <Popover
          open={open}
          onOpenChange={(nextOpen) => {
            onOpenChange(nextOpen);
            setOpen(nextOpen);
          }}
          onClose={onClose}
          portal={false}
        >
          <Popover.Target>
            <button type="button" onClick={() => setOpen((current) => !current)}>
              Toggle details
            </button>
          </Popover.Target>
          <Popover.Dropdown>Controlled details</Popover.Dropdown>
        </Popover>
      );
    }

    renderPopover(<ControlledPopover />);

    const dialog = container.querySelector<HTMLElement>('[role="dialog"]');
    expect(dialog).not.toBeNull();

    act(() => {
      dialog?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onClose).toHaveBeenCalledOnce();
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it.each([
    ['compact', 'calc(17.5rem * var(--mantine-scale))'],
    ['standard', 'calc(18.75rem * var(--mantine-scale))'],
    ['wide', 'calc(31.25rem * var(--mantine-scale))'],
  ] satisfies Array<[PopoverSize, string]>)('maps the %s size to a stable width', (size, width) => {
    renderPopover(
      <Popover defaultOpen size={size} placement="bottom-end" portal={false}>
        <Popover.Target>
          <button type="button">Open sized popover</button>
        </Popover.Target>
        <Popover.Dropdown padding="none" data-popover-surface={size}>
          Sized content
        </Popover.Dropdown>
      </Popover>,
    );

    const dropdown = container.querySelector<HTMLElement>(`[data-popover-surface="${size}"]`);
    expect(dropdown?.style.width).toBe(width);
    expect(dropdown?.style.maxWidth).toBe('calc(100vw - var(--mantine-spacing-xl))');
    expect(dropdown?.style.padding).toBe('0rem');
    expect(dropdown?.style.getPropertyValue('--popover-radius')).toBe('0rem');
    expect(dropdown?.style.getPropertyValue('--popover-shadow')).toBe('var(--mantine-shadow-md)');
    expect(dropdown?.dataset.position).toBe('bottom-end');
  });

  it('portals dropdown content by default', () => {
    renderPopover(
      <Popover defaultOpen>
        <Popover.Target>
          <button type="button">Open portaled popover</button>
        </Popover.Target>
        <Popover.Dropdown data-portaled>Portaled content</Popover.Dropdown>
      </Popover>,
      'default',
    );

    const dropdown = document.body.querySelector<HTMLElement>('[data-portaled]');
    expect(dropdown).not.toBeNull();
    expect(container.contains(dropdown)).toBe(false);
  });
});
