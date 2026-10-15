// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MediaPlayerStatusOverlay } from './MediaPlayerStatusOverlay';

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
describe('Media player shared progress', () => {
  it('reuses indeterminate Progress for media player loading without an invented percentage', () => {
    act(() => root.render(<MediaPlayerStatusOverlay kind="loading" message="Loading track" />));
    const bar = container.querySelector('[role="progressbar"]')!;
    expect(bar).toHaveAttribute('data-core-progress');
    expect(bar).toHaveAttribute('data-contrast', 'image');
    expect(bar).not.toHaveAttribute('aria-valuenow');
    expect(bar).toHaveAccessibleName('Loading track');
    expect(container.querySelectorAll('[role="status"]')).toHaveLength(1);
  });
});
