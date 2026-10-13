// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ProcessingOverlay } from './ProcessingOverlay';

let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});
describe('Shared processing progress', () => {
  it('composes the actual Progress API on its image scrim and retains existing content slots', () => {
    act(() =>
      root.render(
        <ProcessingOverlay
          progress={{ value: 42, 'aria-label': 'Encoding audio', title: 'Processing', status: 'Reading file' }}
        >
          <span>Additional information</span>
        </ProcessingOverlay>,
      ),
    );
    const bar = container.querySelector('[role="progressbar"]')!;
    expect(bar).toHaveAttribute('data-core-progress');
    expect(bar).toHaveAttribute('data-contrast', 'image');
    expect(bar).toHaveAttribute('aria-valuenow', '42');
    expect(bar).toHaveAccessibleName('Encoding audio');
    expect(bar).toHaveAccessibleDescription('Reading file');
    expect(container.textContent).toContain('Additional information');
  });
});
