// @vitest-environment jsdom

import { I18nProvider as DesignSystemProvider } from 'react-aria-components';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Tabs } from './Tabs';

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

describe('Tabs', () => {
  it.each([
    ['horizontal', 'ArrowRight', 'Enter'],
    ['vertical', 'ArrowDown', ' '],
  ] as const)('keeps %s manual focus separate from selection until activation', (orientation, arrow, activationKey) => {
    const onChange = vi.fn();
    act(() =>
      root.render(
        <Tabs defaultValue="first" orientation={orientation} activation="manual" onChange={onChange} aria-label="Views">
          <Tabs.List>
            <Tabs.Tab value="first">First</Tabs.Tab>
            <Tabs.Tab value="second">Second</Tabs.Tab>
          </Tabs.List>
          <Tabs.Panel value="first">First panel</Tabs.Panel>
          <Tabs.Panel value="second">Second panel</Tabs.Panel>
        </Tabs>,
      ),
    );
    const [first, second] = container.querySelectorAll<HTMLElement>('[role="tab"]');
    act(() => first.focus());
    act(() => first.dispatchEvent(new KeyboardEvent('keydown', { key: arrow, bubbles: true, cancelable: true })));
    expect(document.activeElement).toBe(second);
    expect(first.getAttribute('aria-selected')).toBe('true');
    expect(second.getAttribute('aria-selected')).toBe('false');
    expect(onChange).not.toHaveBeenCalled();
    act(() => {
      second.dispatchEvent(new KeyboardEvent('keydown', { key: activationKey, bubbles: true, cancelable: true }));
      second.dispatchEvent(new KeyboardEvent('keyup', { key: activationKey, bubbles: true, cancelable: true }));
    });
    expect(second.getAttribute('aria-selected')).toBe('true');
    expect(onChange).toHaveBeenCalledWith('second');
  });

  it('forwards a root-level collection name to its tablist unless the list supplies its own name', () => {
    const renderNamedTabs = (listLabel?: string) =>
      act(() =>
        root.render(
          <Tabs aria-label="Editor sections" defaultValue="body">
            <Tabs.List aria-label={listLabel}>
              <Tabs.Tab value="body">Body</Tabs.Tab>
              <Tabs.Tab value="settings">Settings</Tabs.Tab>
            </Tabs.List>
            <Tabs.Panel value="body">Draft</Tabs.Panel>
            <Tabs.Panel value="settings">Settings content</Tabs.Panel>
          </Tabs>,
        ),
      );
    renderNamedTabs();
    expect(container.querySelector('[role="tablist"]')?.getAttribute('aria-label')).toBe('Editor sections');
    renderNamedTabs('Document views');
    expect(container.querySelector('[role="tablist"]')?.getAttribute('aria-label')).toBe('Document views');
    expect(container.querySelector('[role="tab"]')?.textContent).toBe('Body');
  });

  it('connects external panel tabs while retaining keyboard selection and forwarded refs', () => {
    const onChange = vi.fn();
    const tabRef = { current: null as HTMLDivElement | null };
    act(() =>
      root.render(
        <>
          <Tabs defaultValue="light" onChange={onChange}>
            <Tabs.List aria-label="Variants">
              <Tabs.Tab value="light" ref={tabRef} externalPanel={{ id: 'canvas', tabId: 'light-tab' }}>
                Light
              </Tabs.Tab>
              <Tabs.Tab value="dark" externalPanel={{ id: 'canvas', tabId: 'dark-tab' }}>
                Dark
              </Tabs.Tab>
            </Tabs.List>
          </Tabs>
          <div id="canvas" role="tabpanel" aria-labelledby="light-tab">
            Canvas
          </div>
        </>,
      ),
    );
    const light = document.getElementById('light-tab')!;
    const dark = document.getElementById('dark-tab')!;
    expect(tabRef.current).toBe(light);
    expect(light.getAttribute('aria-controls')).toBe('canvas');
    expect(dark.getAttribute('aria-controls')).toBe('canvas');
    expect(document.getElementById(light.getAttribute('aria-controls')!)).not.toBeNull();
    act(() => light.focus());
    act(() => light.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })));
    expect(onChange).toHaveBeenCalledWith('dark');
    expect(dark.getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(dark);
    expect(container.querySelectorAll('[role="tabpanel"]')).toHaveLength(1);
  });

  it('provides an accessible compound tab control through the Core boundary', () => {
    const onChange = vi.fn();

    act(() => {
      root.render(
        <DesignSystemProvider>
          <Tabs value="first" onChange={onChange} tone="neutral" appearance="outline">
            <Tabs.List aria-label="Example views">
              <Tabs.Tab value="first">First</Tabs.Tab>
              <Tabs.Tab value="second">Second</Tabs.Tab>
            </Tabs.List>
            <Tabs.Panel value="first">First panel</Tabs.Panel>
            <Tabs.Panel value="second">Second panel</Tabs.Panel>
          </Tabs>
        </DesignSystemProvider>,
      );
    });

    const tabs = container.querySelector('[data-appearance="outline"]');
    const secondTab = container.querySelectorAll<HTMLButtonElement>('[role="tab"]')[1];

    expect(tabs?.getAttribute('data-tone')).toBe('neutral');
    expect(container.querySelector('[role="tablist"]')?.getAttribute('aria-label')).toBe('Example views');
    expect(container.textContent).toContain('First panel');

    act(() => secondTab.click());
    expect(onChange).toHaveBeenCalledWith('second');
  });
  it('keeps inactive panel state mounted and removes it from reading and keyboard navigation', () => {
    act(() =>
      root.render(
        <Tabs defaultValue="first">
          <Tabs.List aria-label="Views">
            <Tabs.Tab value="first">First</Tabs.Tab>
            <Tabs.Tab value="second">Second</Tabs.Tab>
          </Tabs.List>
          <Tabs.Panel value="first">
            <input aria-label="Draft" defaultValue="Unsaved" />
          </Tabs.Panel>
          <Tabs.Panel value="second">
            <button type="button">Second action</button>
          </Tabs.Panel>
        </Tabs>,
      ),
    );
    const input = container.querySelector<HTMLInputElement>('input')!;
    input.value = 'Changed';
    const tabs = container.querySelectorAll<HTMLElement>('[role="tab"]');
    const inactive = container.querySelector('[data-inert]')!;
    expect(inactive.hasAttribute('inert')).toBe(true);
    act(() => tabs[1].click());
    expect(container.querySelector('input')).toBe(input);
    expect(input.value).toBe('Changed');
    expect(input.closest('[data-inert]')?.hasAttribute('inert')).toBe(true);
    const selected = container.querySelector('[role="tab"][aria-selected="true"]')!;
    const panel = document.getElementById(selected.getAttribute('aria-controls')!)!;
    expect(panel.getAttribute('aria-labelledby')).toBe(selected.id);
    expect(panel.hasAttribute('inert')).toBe(false);
  });

  it('supports roving keyboard selection and skips unavailable tabs', () => {
    const onChange = vi.fn();
    act(() =>
      root.render(
        <Tabs defaultValue="first" onChange={onChange}>
          <Tabs.List aria-label="Views">
            <Tabs.Tab value="first">First</Tabs.Tab>
            <Tabs.Tab value="locked" disabled>
              Locked
            </Tabs.Tab>
            <Tabs.Tab value="last">Last</Tabs.Tab>
          </Tabs.List>
          <Tabs.Panel value="first">First panel</Tabs.Panel>
          <Tabs.Panel value="last">Last panel</Tabs.Panel>
        </Tabs>,
      ),
    );
    const first = container.querySelector<HTMLElement>('[role="tab"]')!;
    act(() => first.focus());
    act(() => first.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })));
    expect(onChange).toHaveBeenCalledWith('last');
    expect(container.querySelector('[role="tab"][aria-selected="true"]')?.textContent).toBe('Last');
    expect(container.querySelector('[role="tabpanel"]')?.textContent).toBe('Last panel');
  });
});
