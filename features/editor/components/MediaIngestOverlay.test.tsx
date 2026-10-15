// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MediaIngestOverlay } from './MediaIngestOverlay';

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
describe('Media ingest shared progress', () => {
  it('keeps editor ingest identity, details and measured values in one compact progress bar', () => {
    act(() =>
      root.render(
        <MediaIngestOverlay
          title="Processing"
          accessibleLabel="Processing track two"
          percentage={42.4}
          detail="Preparing audio"
        />,
      ),
    );
    const bar = container.querySelector('[role="progressbar"]')!;
    expect(container.querySelectorAll('[role="progressbar"]')).toHaveLength(1);
    expect(bar).toHaveAccessibleName('Processing track two');
    expect(bar).toHaveAccessibleDescription('Preparing audio · 42%');
    expect(bar).toHaveAttribute('aria-valuenow', '42');
    expect(container.querySelector('[role="status"]')).toHaveAccessibleName('Processing track two');
    expect(
      [...bar.querySelectorAll('[data-core-typography="text"]')].every(
        (node) => node.getAttribute('data-size') === 'xs',
      ),
    ).toBe(true);
  });
});
