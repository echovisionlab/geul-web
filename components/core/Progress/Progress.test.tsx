// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Progress } from './Progress';

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

describe('Progress', () => {
  it('keeps the explicit name separate from compact visible title/status and merges description relations', () => {
    act(() =>
      root.render(
        <>
          <span id="task-context">Track two</span>
          <Progress
            value={42}
            aria-label="Encoding recording"
            aria-describedby="task-context"
            title="Processing"
            status="Preparing audio"
          />
        </>,
      ),
    );
    const bar = container.querySelector('[role="progressbar"]')!;
    expect(bar).toHaveAccessibleName('Encoding recording');
    expect(bar).toHaveAccessibleDescription('Track two Preparing audio');
    expect(bar.querySelectorAll('[data-core-typography="text"]')).toHaveLength(2);
    expect(
      [...bar.querySelectorAll('[data-core-typography="text"]')].every(
        (node) => node.getAttribute('data-size') === 'xs',
      ),
    ).toBe(true);
    expect(bar).not.toHaveAttribute('title');
    act(() => root.render(<Progress value={42} aria-label="Encoding recording" />));
    expect(container.querySelector('[role="progressbar"]')).not.toHaveAttribute('aria-describedby');
  });

  it('projects the shared image contrast without accepting consumer appearance overrides', () => {
    act(() => root.render(<Progress value={null} aria-label="Processing media" contrast="image" title="Processing" />));
    const bar = container.querySelector('[role="progressbar"]')!;
    expect(bar).toHaveAttribute('data-core-progress');
    expect(bar).toHaveAttribute('data-contrast', 'image');
    expect(bar.querySelector('[data-core-typography="text"]')).toHaveAttribute('data-tone', 'inverse');
  });
  it('owns semantic tone and determinate accessibility attributes', () => {
    act(() => {
      root.render(
        <>
          <Progress value={63} tone="positive" aria-label="Encoding audio" />
        </>,
      );
    });

    const progress = container.querySelector<HTMLElement>('[role="progressbar"]');
    expect(progress?.getAttribute('aria-label')).toBe('Encoding audio');
    expect(progress?.getAttribute('aria-valuemin')).toBe('0');
    expect(progress?.getAttribute('aria-valuemax')).toBe('100');
    expect(progress?.getAttribute('aria-valuenow')).toBe('63');
    expect(progress?.getAttribute('data-tone')).toBe('positive');
  });

  it('omits aria-valuenow for indeterminate progress', () => {
    act(() => {
      root.render(
        <>
          <Progress value={null} aria-label="Loading audio engine" />
        </>,
      );
    });

    const progress = container.querySelector<HTMLElement>('[role="progressbar"]');
    expect(progress?.getAttribute('aria-label')).toBe('Loading audio engine');
    expect(progress?.hasAttribute('aria-valuenow')).toBe(false);
    expect(progress?.hasAttribute('aria-valuetext')).toBe(false);
  });
});
