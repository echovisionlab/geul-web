// @vitest-environment jsdom
import { act, useState, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { I18nProvider } from 'react-aria-components';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Button } from './Button/Button';
import { DropdownMenu } from './DropdownMenu/DropdownMenu';
import { Tooltip } from './Tooltip/Tooltip';
import { Popover } from './Popover/Popover';
import { ContentModal } from './Modal/ContentModal';

let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  Object.defineProperty(window.HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() });
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});
async function render(node: ReactNode) {
  await act(async () => {
    root.render(<I18nProvider locale="en-US">{node}</I18nProvider>);
  });
  await flushFocusFrames();
}
async function flushFocusFrames() {
  // React Aria restores a FocusScope on one frame; virtual-cursor focusSafely
  // waits for the following frame before moving focus to the saved opener.
  for (let frame = 0; frame < 2; frame += 1) {
    await act(async () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
  }
}
async function key(node: Element, value: string) {
  await act(async () => {
    node.dispatchEvent(new KeyboardEvent('keydown', { key: value, bubbles: true }));
  });
  await flushFocusFrames();
}
async function click(node: HTMLElement) {
  await act(async () => {
    node.focus();
  });
  expect(document.activeElement).toBe(node);
  await act(async () => {
    node.click();
  });
  await flushFocusFrames();
}

describe('Core React Aria overlay interactions', () => {
  it('opens through a Core Button nested in Tooltip without duplicate press or state callbacks', async () => {
    const onOpenChange = vi.fn();
    const onClick = vi.fn();
    await render(
      <DropdownMenu onChange={onOpenChange}>
        <DropdownMenu.Target>
          <Tooltip label="Commands help">
            <Button onClick={onClick}>Commands</Button>
          </Tooltip>
        </DropdownMenu.Target>
        <DropdownMenu.Dropdown>
          <DropdownMenu.Item>First</DropdownMenu.Item>
        </DropdownMenu.Dropdown>
      </DropdownMenu>,
    );
    const trigger = container.querySelector('button')!;
    await click(trigger);
    expect(document.querySelector('[role="menu"]')).not.toBeNull();
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledExactlyOnceWith(true);
    await key(document.querySelector('[role="menu"]')!, 'Escape');
    expect(document.querySelector('[role="menu"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });
  it('moves menu focus past disabled items, wraps, typeaheads, and invokes an action once', async () => {
    const action = vi.fn();
    await render(
      <DropdownMenu>
        <DropdownMenu.Target>
          <Button>Menu</Button>
        </DropdownMenu.Target>
        <DropdownMenu.Dropdown>
          <DropdownMenu.Item>Alpha</DropdownMenu.Item>
          <DropdownMenu.Item disabled>Blocked</DropdownMenu.Item>
          <DropdownMenu.Item onClick={action}>Charlie</DropdownMenu.Item>
        </DropdownMenu.Dropdown>
      </DropdownMenu>,
    );
    const trigger = container.querySelector('button')!;
    await key(trigger, 'ArrowDown');
    const items = [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')];
    expect(document.activeElement).toBe(items[0]);
    await key(items[0], 'ArrowDown');
    expect(document.activeElement).toBe(items[2]);
    await key(items[2], 'ArrowDown');
    expect(document.activeElement).toBe(items[0]);
    await key(items[0], 'c');
    expect(document.activeElement).toBe(items[2]);
    await click(items[2]);
    expect(action).toHaveBeenCalledTimes(1);
    expect(document.querySelector('[role="menu"]')).toBeNull();
  });
  it('returns focus from a dismissed Popover to its Core trigger', async () => {
    await render(
      <Popover>
        <Popover.Target>
          <Button>Details</Button>
        </Popover.Target>
        <Popover.Dropdown>
          <Button>Inside</Button>
        </Popover.Dropdown>
      </Popover>,
    );
    const trigger = container.querySelector('button')!;
    await click(trigger);
    const dialog = document.querySelector('[role="dialog"]')!;
    expect(dialog.contains(document.activeElement)).toBe(true);
    await key(dialog, 'Escape');
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });
  it('dismisses only the top modal and returns focus through a nested stack', async () => {
    function Stack() {
      const [outer, setOuter] = useState(false);
      const [inner, setInner] = useState(false);
      return (
        <>
          <Button onClick={() => setOuter(true)}>Open outer</Button>
          <ContentModal opened={outer} onClose={() => setOuter(false)} title="Outer" closeLabel="Close outer">
            <Button onClick={() => setInner(true)}>Open inner</Button>
            <ContentModal opened={inner} onClose={() => setInner(false)} title="Inner" closeLabel="Close inner">
              <Button>Inside inner</Button>
            </ContentModal>
          </ContentModal>
        </>
      );
    }
    await render(<Stack />);
    const outerTrigger = container.querySelector('button')!;
    await click(outerTrigger);
    const innerTrigger = [...document.querySelectorAll<HTMLButtonElement>('button')].find(
      (x) => x.textContent === 'Open inner',
    )!;
    await click(innerTrigger);
    expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(2);
    const inner = [...document.querySelectorAll<HTMLElement>('[role="dialog"]')].find((x) =>
      x.textContent?.includes('Inside inner'),
    )!;
    expect(inner).toHaveAccessibleName('Inner');
    await key(inner, 'Escape');
    expect(document.body.textContent).toContain('Outer');
    expect(document.body.textContent).not.toContain('Inside inner');
    await vi.waitFor(() => expect(document.activeElement).toBe(innerTrigger));
    await key(document.querySelector('[role="dialog"]')!, 'Escape');
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(outerTrigger);
  });
});
