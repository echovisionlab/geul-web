// @vitest-environment jsdom

import { act, useState, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MantineProvider } from '@mantine/core';
import { Disclosure } from './Disclosure';

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

function renderDisclosure(node: ReactNode) {
  act(() => {
    root.render(<MantineProvider env="test">{node}</MantineProvider>);
  });
}

describe('Disclosure', () => {
  it('owns accessible open state and emits semantic boolean changes', () => {
    const onChange = vi.fn();

    function Example() {
      const [opened, setOpened] = useState(false);

      return (
        <Disclosure
          label="Details"
          opened={opened}
          onChange={(nextOpened) => {
            setOpened(nextOpened);
            onChange(nextOpened);
          }}
        >
          Additional details
        </Disclosure>
      );
    }

    renderDisclosure(<Example />);

    const trigger = container.querySelector<HTMLButtonElement>('button[data-accordion-control]');
    const panelId = trigger?.getAttribute('aria-controls');

    expect(trigger?.type).toBe('button');
    expect(trigger?.getAttribute('aria-expanded')).toBe('false');
    expect(panelId).toBeTruthy();
    expect(container.querySelector(`#${panelId}`)?.getAttribute('aria-labelledby')).toBe(trigger?.id);

    act(() => trigger?.click());

    expect(onChange).toHaveBeenCalledWith(true);
    expect(trigger?.getAttribute('aria-expanded')).toBe('true');
    expect(container.textContent).toContain('Additional details');
  });

  it('maps presentation choices to Core-owned semantic state', () => {
    renderDisclosure(
      <Disclosure
        label="Navigation group"
        appearance="filled"
        density="compact"
        shape="square"
        contentIndent="small"
        defaultOpened
      >
        Nested links
      </Disclosure>,
    );

    const disclosure = container.querySelector<HTMLElement>('[data-disclosure]');
    const trigger = disclosure?.querySelector<HTMLButtonElement>('button');

    expect(disclosure?.getAttribute('data-appearance')).toBe('filled');
    expect(disclosure?.getAttribute('data-density')).toBe('compact');
    expect(disclosure?.getAttribute('data-shape')).toBe('square');
    expect(disclosure?.getAttribute('data-content-indent')).toBe('small');
    expect(disclosure?.getAttribute('data-variant')).toBe('filled');
    expect(trigger?.getAttribute('aria-expanded')).toBe('true');
  });

  it('does not change state when disabled', () => {
    const onChange = vi.fn();
    renderDisclosure(
      <Disclosure label="Unavailable" disabled onChange={onChange}>
        Hidden content
      </Disclosure>,
    );

    const trigger = container.querySelector<HTMLButtonElement>('button[data-accordion-control]');
    act(() => trigger?.click());

    expect(trigger?.disabled).toBe(true);
    expect(trigger?.getAttribute('aria-expanded')).toBe('false');
    expect(onChange).not.toHaveBeenCalled();
  });
});
