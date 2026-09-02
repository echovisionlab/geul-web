// @vitest-environment jsdom

import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MantineProvider } from '@mantine/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DropdownMenu } from './DropdownMenu';

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

function renderDropdownMenu(node: ReactNode) {
  act(() => {
    root.render(<MantineProvider>{node}</MantineProvider>);
  });
}

describe('DropdownMenu', () => {
  it('exposes the required compound API', () => {
    expect(DropdownMenu.Target).toBeDefined();
    expect(DropdownMenu.Dropdown).toBeDefined();
    expect(DropdownMenu.Item).toBeDefined();
    expect(DropdownMenu.Label).toBeDefined();
    expect(DropdownMenu.Divider).toBeDefined();
    expect(DropdownMenu.Sub).toBeDefined();
    expect(DropdownMenu.Sub.Target).toBeDefined();
    expect(DropdownMenu.Sub.Dropdown).toBeDefined();
  });

  it('applies Core sizing and radius while preserving selected, disabled, and destructive semantics', () => {
    const onSelect = vi.fn();
    const onDisabled = vi.fn();

    renderDropdownMenu(
      <DropdownMenu size="compact" placement="bottom-end" portal={false} defaultOpened>
        <DropdownMenu.Target>
          <button type="button">Commands</button>
        </DropdownMenu.Target>
        <DropdownMenu.Dropdown>
          <DropdownMenu.Label>View</DropdownMenu.Label>
          <DropdownMenu.Item
            selected
            icon={<svg data-testid="item-icon" width="16" height="16" aria-hidden />}
            onClick={onSelect}
          >
            Grid
          </DropdownMenu.Item>
          <DropdownMenu.Item disabled onClick={onDisabled}>
            Locked
          </DropdownMenu.Item>
          <DropdownMenu.Divider />
          <DropdownMenu.Item tone="danger">Delete</DropdownMenu.Item>
        </DropdownMenu.Dropdown>
      </DropdownMenu>,
    );

    const dropdown = document.querySelector<HTMLElement>('[data-menu-dropdown]');
    const selected = document.querySelector<HTMLButtonElement>('[data-selected="true"]');
    const disabled = Array.from(document.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')).find(
      (item) => item.textContent === 'Locked',
    );
    const destructive = document.querySelector<HTMLElement>('[data-tone="danger"]');
    const trigger = Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find(
      (button) => button.textContent === 'Commands',
    );
    const label = selected?.previousElementSibling as HTMLElement | null;
    const divider = disabled?.nextElementSibling as HTMLElement | null;
    const iconSection = selected?.querySelector<HTMLElement>('[data-position="left"]');
    const checkSection = selected?.querySelector<HTMLElement>('[data-position="right"]');

    expect(dropdown?.style.width).toBe('calc(10rem * var(--mantine-scale))');
    expect(dropdown?.style.getPropertyValue('--popover-radius')).toBe('0rem');
    expect(dropdown?.style.padding).toBe('3px');
    expect(selected?.style.fontSize).toBe('var(--mantine-font-size-xs)');
    expect(selected?.style.minHeight).toBe('30px');
    expect(selected?.style.padding).toBe('4px 8px');
    expect(selected?.style.borderRadius).toBe('0px');
    expect(label?.style.fontSize).toBe('10px');
    expect(label?.style.fontWeight).toBe('600');
    expect(label?.style.padding).toBe('3px 8px');
    expect(divider?.style.margin).toBe('3px 2px');
    expect(iconSection?.style.width).toBe('16px');
    expect(iconSection?.style.height).toBe('16px');
    expect(checkSection?.style.width).toBe('16px');
    expect(checkSection?.style.height).toBe('16px');
    expect(trigger?.getAttribute('aria-haspopup')).toBe('menu');
    expect(trigger?.getAttribute('aria-expanded')).toBe('true');
    expect(selected?.getAttribute('role')).toBe('menuitem');
    expect(selected?.getAttribute('aria-current')).toBe('true');
    expect(selected?.getAttribute('data-selected')).toBe('true');
    expect(disabled?.disabled).toBe(true);
    expect(destructive?.textContent).toBe('Delete');

    act(() => disabled?.click());
    expect(onDisabled).not.toHaveBeenCalled();

    act(() => selected?.click());
    expect(onSelect).toHaveBeenCalledTimes(1);
  });
});
