// @vitest-environment jsdom

import { mockBrowserNavigation } from '../testing/browser-navigation';
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { I18nProvider, RouterProvider } from 'react-aria-components';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Tooltip } from '../Tooltip';
import { IconButton } from '../IconButton';
import { DropdownMenu } from './DropdownMenu';
import { NavigationIntentProvider } from '../Navigation';

const browserNavigation = mockBrowserNavigation();

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  browserNavigation.attach(container);
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
    root.render(<I18nProvider locale="en-US">{node}</I18nProvider>);
  });
  browserNavigation.attach(container.firstElementChild as HTMLElement);
}

describe('DropdownMenu', () => {
  it('lets the application navigation guard cancel an ordinary menu link', () => {
    const navigate = vi.fn();
    const guard = vi.fn((_, event: { preventDefault: () => void }) => event.preventDefault());
    renderDropdownMenu(
      <RouterProvider navigate={navigate}>
        <NavigationIntentProvider onNavigationIntent={guard}>
          <DropdownMenu defaultOpened portal={false}>
            <DropdownMenu.Target>
              <button type="button">Navigation</button>
            </DropdownMenu.Target>
            <DropdownMenu.Dropdown>
              <DropdownMenu.Item href="/documents">Documents</DropdownMenu.Item>
            </DropdownMenu.Dropdown>
          </DropdownMenu>
        </NavigationIntentProvider>
      </RouterProvider>,
    );
    act(() => document.querySelector<HTMLAnchorElement>('[role="menuitem"]')!.click());
    expect(guard).toHaveBeenCalledWith(
      { href: 'http://localhost:3000/documents' },
      { preventDefault: expect.any(Function) },
    );
    expect(navigate).not.toHaveBeenCalled();
  });

  it('keeps allowed menu routing and leaves modified link clicks outside the application guard', () => {
    const navigate = vi.fn();
    const guard = vi.fn();
    const renderLink = () =>
      renderDropdownMenu(
        <RouterProvider navigate={navigate}>
          <NavigationIntentProvider onNavigationIntent={guard}>
            <DropdownMenu defaultOpened portal={false}>
              <DropdownMenu.Target>
                <button type="button">Navigation</button>
              </DropdownMenu.Target>
              <DropdownMenu.Dropdown>
                <DropdownMenu.Item href="/documents">Documents</DropdownMenu.Item>
              </DropdownMenu.Dropdown>
            </DropdownMenu>
          </NavigationIntentProvider>
        </RouterProvider>,
      );
    renderLink();
    act(() => document.querySelector<HTMLAnchorElement>('[role="menuitem"]')!.click());
    expect(guard).toHaveBeenCalledOnce();
    expect(navigate).toHaveBeenCalledOnce();
    act(() => root.render(null));
    guard.mockClear();
    navigate.mockClear();
    renderLink();
    const modifiedClick = new MouseEvent('click', { bubbles: true, cancelable: true, ctrlKey: true });
    act(() => document.querySelector<HTMLAnchorElement>('[role="menuitem"]')!.dispatchEvent(modifiedClick));
    expect(guard).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
    expect(browserNavigation.navigate).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ href: 'http://localhost:3000/documents', ctrlKey: true }),
    );
  });

  it('opens from the keyboard, skips disabled commands and restores the trigger after Escape', async () => {
    renderDropdownMenu(
      <DropdownMenu portal={false}>
        <DropdownMenu.Target>
          <button type="button">Document commands</button>
        </DropdownMenu.Target>
        <DropdownMenu.Dropdown>
          <DropdownMenu.Item>Open</DropdownMenu.Item>
          <DropdownMenu.Item disabled>Unavailable</DropdownMenu.Item>
          <DropdownMenu.Item>Save</DropdownMenu.Item>
        </DropdownMenu.Dropdown>
      </DropdownMenu>,
    );
    const trigger = container.querySelector<HTMLButtonElement>('button')!;
    await act(async () => {
      trigger.focus();
      trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
    });
    const menu = document.querySelector<HTMLElement>('[role="menu"]')!;
    expect(menu).not.toBeNull();
    const items = Array.from(menu.querySelectorAll<HTMLElement>('[role="menuitem"]'));
    expect(document.activeElement).toBe(items[0]);
    act(() =>
      items[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true })),
    );
    expect(document.activeElement).toBe(items[2]);
    act(() => items[2].dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true, cancelable: true })));
    expect(document.activeElement).toBe(items[0]);
    await act(async () => {
      items[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    });
    await vi.waitFor(() => expect(document.querySelector('[role="menu"]')).toBeNull());
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    await vi.waitFor(() => expect(document.activeElement).toBe(trigger));
  });

  it('adapts a native sensor handle through a tooltip to the functional menu trigger', () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      renderDropdownMenu(
        <DropdownMenu portal={false}>
          <DropdownMenu.Target>
            <Tooltip label="Block actions" events={{ focus: false }}>
              <IconButton label="Block actions" interaction="drag-handle">
                <svg aria-hidden />
              </IconButton>
            </Tooltip>
          </DropdownMenu.Target>
          <DropdownMenu.Dropdown>
            <DropdownMenu.Item>Delete block</DropdownMenu.Item>
          </DropdownMenu.Dropdown>
        </DropdownMenu>,
      );
      const button = container.querySelector('button')!;
      expect(container.querySelectorAll('button')).toHaveLength(1);
      expect(container.querySelector('[role="button"]')).toBeNull();
      act(() => button.click());
      expect(button.getAttribute('aria-expanded')).toBe('true');
      expect(document.querySelector('[role="menuitem"]')?.textContent).toBe('Delete block');
      expect(warning.mock.calls.some((call) => String(call[0]).includes('PressResponder'))).toBe(false);
    } finally {
      warning.mockRestore();
    }
  });

  it('keeps editing content accessible while a nonmodal contextual menu opens and its document mutates', async () => {
    const action = vi.fn();
    renderDropdownMenu(
      <>
        <div data-editor-content contentEditable suppressContentEditableWarning>
          Editable document
        </div>
        <DropdownMenu defaultOpened portal={false}>
          <DropdownMenu.Target>
            <button type="button">Actions</button>
          </DropdownMenu.Target>
          <DropdownMenu.Dropdown>
            <DropdownMenu.Item onClick={action}>Apply</DropdownMenu.Item>
          </DropdownMenu.Dropdown>
        </DropdownMenu>
      </>,
    );
    const editor = container.querySelector<HTMLElement>('[data-editor-content]')!;
    expect(editor.closest('[aria-hidden="true"]')).toBeNull();
    await act(async () => {
      editor.append(document.createElement('span'));
      await Promise.resolve();
    });
    expect(editor.closest('[aria-hidden="true"]')).toBeNull();
    const item = document.querySelector<HTMLElement>('[role="menuitem"]')!;
    act(() => item.click());
    expect(action).toHaveBeenCalledOnce();
    expect(document.querySelector('[role="menu"]')).toBeNull();
  });

  it('routes a tooltip trigger ref to its sole action without an extra pressable or tab stop', () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      renderDropdownMenu(
        <DropdownMenu portal={false}>
          <DropdownMenu.Target>
            <Tooltip label="Formatting" events={{ focus: false }}>
              <IconButton label="Formatting">
                <svg aria-hidden />
              </IconButton>
            </Tooltip>
          </DropdownMenu.Target>
          <DropdownMenu.Dropdown>
            <DropdownMenu.Item>Bold</DropdownMenu.Item>
          </DropdownMenu.Dropdown>
        </DropdownMenu>,
      );
      const trigger = container.querySelector('button')!;
      expect(container.querySelectorAll('button')).toHaveLength(1);
      expect(container.querySelector('[role=button]')).toBeNull();
      act(() => trigger.click());
      expect(document.querySelector('[role=menu]')).not.toBeNull();
      expect(trigger.getAttribute('aria-expanded')).toBe('true');
      expect(warning.mock.calls.some((call) => String(call[0]).includes('Pressable'))).toBe(false);
    } finally {
      warning.mockRestore();
    }
  });
  it('suppresses an enclosing hint while the actual menu opens', () => {
    renderDropdownMenu(
      <Tooltip label="Command hint" opened withinPortal={false}>
        <span>
          <DropdownMenu portal={false}>
            <DropdownMenu.Target>
              <button type="button">Commands</button>
            </DropdownMenu.Target>
            <DropdownMenu.Dropdown>
              <DropdownMenu.Item>Open</DropdownMenu.Item>
            </DropdownMenu.Dropdown>
          </DropdownMenu>
        </span>
      </Tooltip>,
    );
    expect(document.querySelector('[role=tooltip]')?.textContent).toContain('Command hint');
    const trigger = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent === 'Commands',
    )!;
    act(() => trigger.click());
    expect(document.querySelector('[role=menu]')).not.toBeNull();
    expect(document.querySelector('[role=tooltip]')).toBeNull();
  });
  it('suppresses a target hint inside an opened menu boundary', () => {
    renderDropdownMenu(
      <DropdownMenu portal={false} defaultOpened>
        <DropdownMenu.Target>
          <Tooltip label="Command hint" opened withinPortal={false}>
            <button type="button">Commands</button>
          </Tooltip>
        </DropdownMenu.Target>
        <DropdownMenu.Dropdown>
          <DropdownMenu.Item>Open</DropdownMenu.Item>
        </DropdownMenu.Dropdown>
      </DropdownMenu>,
    );
    expect(document.querySelector('[role=menu]')).not.toBeNull();
    expect(document.querySelector('[role=tooltip]')).toBeNull();
  });
  it('opens a programmatic menu from a hidden point anchor without a pressable trigger', () => {
    const warn = vi.spyOn(console, 'warn');
    const error = vi.spyOn(console, 'error');
    renderDropdownMenu(
      <DropdownMenu opened portal={false}>
        <DropdownMenu.Anchor x={120} y={80} />
        <DropdownMenu.Dropdown>
          <DropdownMenu.Item>Preview</DropdownMenu.Item>
        </DropdownMenu.Dropdown>
      </DropdownMenu>,
    );
    const anchor = container.querySelector<HTMLElement>('[data-dropdown-menu-anchor]');
    expect(anchor?.getAttribute('aria-hidden')).toBe('true');
    expect(anchor?.hasAttribute('tabindex')).toBe(false);
    expect(anchor?.style.left).toBe('120px');
    expect(anchor?.style.top).toBe('80px');
    expect(container.querySelector('[role=menuitem]')?.textContent).toBe('Preview');
    const reported = [...warn.mock.calls, ...error.mock.calls].map((call) => String(call[0]));
    expect(reported.filter((message) => /Pressable|PressResponder|Focusable/.test(message))).toEqual([]);
    warn.mockRestore();
    error.mockRestore();
  });

  it('exposes the required compound API', () => {
    expect(DropdownMenu.Target).toBeDefined();
    expect(DropdownMenu.Anchor).toBeDefined();
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
    const selected = document.querySelector<HTMLButtonElement>('[data-core-selected="true"]');
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

    expect(dropdown?.getAttribute('data-size')).toBe('compact');
    expect(label?.textContent).toBe('View');
    expect(divider?.getAttribute('role')).toBe('separator');
    expect(iconSection?.querySelector('[data-testid="item-icon"]')).not.toBeNull();
    expect(checkSection?.querySelector('svg')).not.toBeNull();
    expect(['menu', 'true']).toContain(trigger?.getAttribute('aria-haspopup'));
    expect(trigger?.getAttribute('aria-expanded')).toBe('true');
    expect(selected?.getAttribute('role')).toBe('menuitem');
    expect(selected?.getAttribute('aria-current')).toBe('true');
    expect(selected?.getAttribute('data-core-selected')).toBe('true');
    expect(disabled?.getAttribute('aria-disabled')).toBe('true');
    expect(destructive?.textContent).toBe('Delete');

    act(() => disabled?.click());
    expect(onDisabled).not.toHaveBeenCalled();

    act(() => selected?.click());
    expect(onSelect).toHaveBeenCalledTimes(1);
  });
});

it('keeps actions distinct across sibling fragments and nested fragment lists', () => {
  const first = vi.fn();
  const second = vi.fn();
  const last = vi.fn();
  renderDropdownMenu(
    <DropdownMenu portal={false} defaultOpened>
      <DropdownMenu.Target>
        <button type="button">Actions</button>
      </DropdownMenu.Target>
      <DropdownMenu.Dropdown>
        <>
          <DropdownMenu.Item onClick={first}>First</DropdownMenu.Item>
        </>
        <>
          <>
            <DropdownMenu.Item onClick={second}>Second</DropdownMenu.Item>
          </>
        </>
        <>
          <DropdownMenu.Item onClick={last}>Last</DropdownMenu.Item>
        </>
      </DropdownMenu.Dropdown>
    </DropdownMenu>,
  );
  const items = [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')];
  expect(items.map((item) => item.textContent)).toEqual(['First', 'Second', 'Last']);
  act(() => items[2].click());
  expect(last).toHaveBeenCalledOnce();
  expect(first).not.toHaveBeenCalled();
  expect(second).not.toHaveBeenCalled();
});

describe('DropdownMenu outside interaction', () => {
  function pointerDownUp(target: Element) {
    for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) {
      const event = type.startsWith('pointer')
        ? new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 1, pointerType: 'mouse', button: 0 })
        : new MouseEvent(type, { bubbles: true, cancelable: true, button: 0 });
      act(() => {
        target.dispatchEvent(event);
      });
    }
  }

  it('closes a click-triggered menu when the pointer goes down outside it', () => {
    const onClose = vi.fn();
    const outside = document.createElement('button');
    document.body.appendChild(outside);
    renderDropdownMenu(
      <DropdownMenu defaultOpened onClose={onClose}>
        <DropdownMenu.Target>
          <button type="button">Variables</button>
        </DropdownMenu.Target>
        <DropdownMenu.Dropdown>
          <DropdownMenu.Item>{'{{site_name}}'}</DropdownMenu.Item>
        </DropdownMenu.Dropdown>
      </DropdownMenu>,
    );
    expect(document.querySelector('[role="menu"]')).not.toBeNull();
    pointerDownUp(outside);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(document.querySelector('[role="menu"]')).toBeNull();
    outside.remove();
  });

  it('keeps the menu open while interacting inside it', () => {
    const onClose = vi.fn();
    renderDropdownMenu(
      <DropdownMenu defaultOpened onClose={onClose} closeOnItemClick={false}>
        <DropdownMenu.Target>
          <button type="button">Variables</button>
        </DropdownMenu.Target>
        <DropdownMenu.Dropdown>
          <DropdownMenu.Item>{'{{site_name}}'}</DropdownMenu.Item>
        </DropdownMenu.Dropdown>
      </DropdownMenu>,
    );
    const item = document.querySelector('[role="menuitem"]');
    expect(item).not.toBeNull();
    pointerDownUp(item!);
    expect(onClose).not.toHaveBeenCalled();
    expect(document.querySelector('[role="menu"]')).not.toBeNull();
  });
});
