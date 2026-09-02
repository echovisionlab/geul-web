// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { RouteProgressBar } from './RouteProgressBar';

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

describe('RouteProgressBar', () => {
  it('renders an indeterminate, non-interactive route progress indicator', () => {
    act(() => root.render(<RouteProgressBar phase="loading" aria-label="Loading page" />));

    const rootElement = container.querySelector<HTMLElement>('[data-route-progress]');
    const progress = container.querySelector<HTMLElement>('[role="progressbar"]');
    expect(rootElement?.getAttribute('data-phase')).toBe('loading');
    expect(rootElement?.hasAttribute('aria-hidden')).toBe(false);
    expect(progress?.getAttribute('aria-label')).toBe('Loading page');
    expect(progress?.hasAttribute('aria-valuenow')).toBe(false);
  });

  it('hides the idle indicator from assistive technology', () => {
    act(() => root.render(<RouteProgressBar phase="idle" aria-label="Loading page" />));

    expect(container.querySelector('[data-route-progress]')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('keeps the delayed waiting phase hidden', () => {
    act(() => root.render(<RouteProgressBar phase="waiting" aria-label="Loading page" />));

    expect(container.querySelector('[data-route-progress]')?.getAttribute('aria-hidden')).toBe('true');
  });
});
