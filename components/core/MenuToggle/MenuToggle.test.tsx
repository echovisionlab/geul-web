// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MantineProvider } from '@mantine/core';
import { MenuToggle } from './MenuToggle';

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

describe('MenuToggle', () => {
  it('exposes menu state and relationship without leaking Burger props', () => {
    const onClick = vi.fn();

    act(() => {
      root.render(
        <MantineProvider env="test">
          <MenuToggle
            opened={false}
            label="Toggle navigation"
            controls="primary-navigation"
            size="compact"
            visibility="mobile-only"
            onClick={onClick}
          />
        </MantineProvider>,
      );
    });

    const toggle = container.querySelector<HTMLButtonElement>('[data-menu-toggle]');

    expect(toggle?.type).toBe('button');
    expect(toggle?.getAttribute('aria-label')).toBe('Toggle navigation');
    expect(toggle?.getAttribute('aria-expanded')).toBe('false');
    expect(toggle?.getAttribute('aria-controls')).toBe('primary-navigation');
    expect(toggle?.getAttribute('data-size')).toBe('compact');
    expect(toggle?.getAttribute('data-visibility')).toBe('mobile-only');
    expect(toggle?.className).toContain('mantine-hidden-from-sm');

    act(() => toggle?.click());
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('preserves the opened and disabled button states', () => {
    const onClick = vi.fn();

    act(() => {
      root.render(
        <MantineProvider env="test">
          <MenuToggle opened label="Close menu" disabled onClick={onClick} />
        </MantineProvider>,
      );
    });

    const toggle = container.querySelector<HTMLButtonElement>('[data-menu-toggle]');
    act(() => toggle?.click());

    expect(toggle?.disabled).toBe(true);
    expect(toggle?.getAttribute('aria-expanded')).toBe('true');
    expect(toggle?.getAttribute('data-opened')).toBe('true');
    expect(onClick).not.toHaveBeenCalled();
  });
});
