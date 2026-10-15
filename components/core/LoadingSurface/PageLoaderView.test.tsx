// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PageLoaderView } from './PageLoaderView';

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});
describe('PageLoaderView pending announcements', () => {
  it('keeps its pending message available without permanently queueing its own status region', () => {
    act(() => root.render(<PageLoaderView imageAlt="Loading page" message="Connecting" />));
    const status = host.querySelector('[role="status"]')!;
    expect(status).toHaveAccessibleName('Loading page');
    expect(status).not.toHaveAttribute('aria-busy');
    expect(status.textContent).toBe('Connecting');
    expect(status.querySelector('[data-core-typography="text"]')).toHaveAttribute('data-size', 'xs');
    act(() => root.render(<PageLoaderView imageAlt="Loading page" message="Loading content" />));
    expect(status.textContent).toBe('Loading content');
    expect(host.querySelectorAll('[role="status"]')).toHaveLength(1);
  });
});
