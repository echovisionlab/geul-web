// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MantineProvider } from '@mantine/core';
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
  it('owns semantic tone and determinate accessibility attributes', () => {
    act(() => {
      root.render(
        <MantineProvider>
          <Progress value={63} tone="positive" aria-label="Encoding audio" />
        </MantineProvider>,
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
        <MantineProvider>
          <Progress value={null} aria-label="Loading audio engine" />
        </MantineProvider>,
      );
    });

    const progress = container.querySelector<HTMLElement>('[role="progressbar"]');
    expect(progress?.getAttribute('aria-label')).toBe('Loading audio engine');
    expect(progress?.hasAttribute('aria-valuenow')).toBe(false);
    expect(progress?.hasAttribute('aria-valuetext')).toBe(false);
  });
});
