// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MantineProvider } from '@mantine/core';
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
  it('provides an accessible compound tab control through the Core boundary', () => {
    const onChange = vi.fn();

    act(() => {
      root.render(
        <MantineProvider>
          <Tabs value="first" onChange={onChange} tone="neutral" appearance="outline">
            <Tabs.List aria-label="Example views">
              <Tabs.Tab value="first">First</Tabs.Tab>
              <Tabs.Tab value="second">Second</Tabs.Tab>
            </Tabs.List>
            <Tabs.Panel value="first">First panel</Tabs.Panel>
            <Tabs.Panel value="second">Second panel</Tabs.Panel>
          </Tabs>
        </MantineProvider>,
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
});
