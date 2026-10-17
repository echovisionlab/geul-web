// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { I18nProvider } from 'react-aria-components';
import { IconButton } from '../IconButton';
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
      <I18nProvider locale="en-US">
        <Tooltip label="Tooltip label" withinPortal={false} {...props}>
          <button type="button" aria-label="Tooltip target">
            Target
          </button>
        </Tooltip>
      </I18nProvider>,
    );
  });
}

describe('Tooltip', () => {
  it('keeps native sensor Space/Enter keys available without installing a press handler for a focus hint', () => {
    act(() =>
      root.render(
        <Tooltip label="Move item" events={{ focus: false }}>
          <IconButton label="Move item" interaction="drag-handle">
            <svg aria-hidden />
          </IconButton>
        </Tooltip>,
      ),
    );
    const button = container.querySelector('button')!;
    const keys: string[] = [];
    const sensor = (event: KeyboardEvent) => keys.push(event.key);
    document.addEventListener('keydown', sensor);
    try {
      expect(container.querySelectorAll('button')).toHaveLength(1);
      expect(container.querySelector('[role="button"]')).toBeNull();
      act(() => button.focus());
      expect(document.activeElement).toBe(button);
      for (const key of [' ', 'Enter']) {
        const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
        act(() => button.dispatchEvent(event));
        expect(event.defaultPrevented).toBe(false);
      }
      expect(keys).toEqual([' ', 'Enter']);
    } finally {
      document.removeEventListener('keydown', sensor);
    }
  });

  it('renders a controlled open tooltip through the Core boundary', () => {
    renderTooltip({ opened: true });

    const tooltip = container.querySelector('[role="tooltip"]');
    expect(tooltip?.textContent).toContain('Tooltip label');
    expect(container.querySelector('button')?.getAttribute('aria-label')).toBe('Tooltip target');
  });

  it('forwards multiline layout props', () => {
    renderTooltip({ opened: true, multiline: true, size: 'compact' });

    const tooltip = container.querySelector<HTMLElement>('[role="tooltip"]');
    expect(tooltip?.getAttribute('data-multiline')).toBe('true');
    expect(tooltip?.dataset.size).toBe('compact');
  });

  it('does not render tooltip content when disabled', () => {
    renderTooltip({ opened: true, disabled: true });

    expect(container.querySelector('[role="tooltip"]')).toBeNull();
    expect(container.querySelector('button')).not.toBeNull();
  });
  it('allows passive non-action hints to remain outside a toolbar tab sequence', () => {
    act(() =>
      root.render(
        <Tooltip label="Width" tabIndex={-1} events={{ focus: false }}>
          <span role="img" aria-label="Width 64%">
            64%
          </span>
        </Tooltip>,
      ),
    );
    const target = container.querySelector('[role="img"]') as HTMLElement;
    expect(target.tabIndex).toBe(-1);
    act(() => target.focus());
    expect(container.querySelector('[role="tooltip"]')).toBeNull();
  });
  it('keeps described action focus and Escape available when focus hints are deliberately disabled', () => {
    act(() =>
      root.render(
        <Tooltip label="Delete" events={{ focus: false }}>
          <button type="button" aria-label="Delete">
            Delete
          </button>
        </Tooltip>,
      ),
    );
    const button = container.querySelector('button')!;
    act(() => button.focus());
    expect(document.activeElement).toBe(button);
    expect(container.querySelector('[role="tooltip"]')).toBeNull();
    let escapes = 0;
    const receive = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        escapes++;
      }
    };
    button.addEventListener('keydown', receive);
    act(() => button.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    expect(escapes).toBe(1);
    button.removeEventListener('keydown', receive);
  });
});
