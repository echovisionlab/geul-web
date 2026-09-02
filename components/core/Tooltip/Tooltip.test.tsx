// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MantineProvider } from '@mantine/core';
import { Tooltip, type TooltipProps } from './Tooltip';

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

function renderTooltip(props: Partial<TooltipProps> = {}) {
  act(() => {
    root.render(
      <MantineProvider env="test">
        <Tooltip label="Tooltip label" withinPortal={false} transitionProps={{ duration: 0 }} {...props}>
          <button type="button" aria-label="Tooltip target">
            Target
          </button>
        </Tooltip>
      </MantineProvider>,
    );
  });
}

describe('Tooltip', () => {
  it('renders a controlled open tooltip through the Core boundary', () => {
    renderTooltip({ opened: true });

    const tooltip = container.querySelector('[role="tooltip"]');
    expect(tooltip?.textContent).toContain('Tooltip label');
    expect(container.querySelector('button')?.getAttribute('aria-label')).toBe('Tooltip target');
  });

  it('forwards multiline layout props', () => {
    renderTooltip({ opened: true, multiline: true, w: 240 });

    const tooltip = container.querySelector<HTMLElement>('[role="tooltip"]');
    expect(tooltip?.getAttribute('data-multiline')).toBe('true');
    expect(tooltip?.style.width).toBe('calc(15rem * var(--mantine-scale))');
  });

  it('does not render tooltip content when disabled', () => {
    renderTooltip({ opened: true, disabled: true });

    expect(container.querySelector('[role="tooltip"]')).toBeNull();
    expect(container.querySelector('button')).not.toBeNull();
  });
});
