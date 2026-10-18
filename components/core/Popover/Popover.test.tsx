// @vitest-environment jsdom

import { act, useState, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { I18nProvider } from 'react-aria-components';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Popover } from './Popover';

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

function renderPopover(node: ReactNode, _env: 'default' | 'test' = 'test') {
  act(() => {
    root.render(<I18nProvider locale="en-US">{node}</I18nProvider>);
  });
}

describe('Popover', () => {
  it('preserves alertdialog meaning and rejects roles that the dialog surface cannot implement', () => {
    const renderRole = (role: 'dialog' | 'alertdialog') =>
      renderPopover(
        <Popover defaultOpen portal={false}>
          <Popover.Target>
            <button type="button">Review notice</button>
          </Popover.Target>
          <Popover.Dropdown role={role} aria-label="Notice">
            Notice details
          </Popover.Dropdown>
        </Popover>,
      );
    renderRole('alertdialog');
    expect(container.querySelector('[role="alertdialog"]')?.getAttribute('aria-label')).toBe('Notice');
    expect(() => renderRole('menu' as 'dialog')).toThrow('Invalid popover role');
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
    expect(container.querySelector('[role="dialog"]')?.getAttribute('aria-labelledby')).toBe(target?.id);

    act(() => target?.click());

    expect(target?.getAttribute('aria-expanded')).toBe('false');
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it('names its dialog from the consumer heading', () => {
    renderPopover(
      <Popover defaultOpen portal={false}>
        <Popover.Target>
          <button type="button">View settings</button>
        </Popover.Target>
        <Popover.Dropdown aria-labelledby="view-heading" aria-describedby="view-description">
          <h2 id="view-heading">View settings</h2>
          <p id="view-description">Applies to this view</p>
        </Popover.Dropdown>
      </Popover>,
    );
    expect(container.querySelector('[role="dialog"]')?.getAttribute('aria-labelledby')).toBe('view-heading');
    expect(container.querySelector('[role="dialog"]')?.getAttribute('aria-describedby')).toBe('view-description');
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
