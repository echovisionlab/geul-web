// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TestProviders } from '@/test/TestProviders';
import { ContentChrome } from './ui/ContentChrome';
import { ContentLayoutView } from './ContentLayoutView';

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

function render(node: React.ReactNode) {
  act(() => root.render(<TestProviders>{node}</TestProviders>));
}

describe('ContentLayoutView', () => {
  it('keeps flow chrome inside document content', () => {
    render(
      <ContentLayoutView
        layout={{ contentHeight: 'content', pageChrome: 'flow', footer: 'flow' }}
        chrome={<ContentChrome title="Page" />}
      >
        <div>Body</div>
      </ContentLayoutView>,
    );

    expect(container.querySelector('[data-content-scroll-root]')).toBeNull();
    expect(container.textContent).toContain('Page');
    expect(container.textContent).toContain('Body');
  });

  it('keeps viewport content in document flow while reserving pinned chrome', () => {
    render(
      <ContentLayoutView
        layout={{ contentHeight: 'viewport', pageChrome: 'pinned', footer: 'pinned' }}
        chrome={<ContentChrome title="Page" />}
      >
        <div>Body</div>
      </ContentLayoutView>,
    );

    const layout = container.querySelector('[data-content-layout]');
    expect(layout?.getAttribute('data-content-height')).toBe('viewport');
    expect(layout?.getAttribute('data-page-chrome')).toBe('pinned');
    expect(layout?.getAttribute('data-footer-layout')).toBe('pinned');
    expect(layout?.getAttribute('data-has-chrome')).toBe('true');
    expect(container.querySelector('[data-content-scroll-root]')).toBeNull();
    expect(container.querySelector('[data-content-body]')?.getAttribute('tabindex')).toBeNull();
  });

  it('does not reserve an empty pinned chrome row when chrome is absent', () => {
    render(
      <ContentLayoutView layout={{ contentHeight: 'viewport', pageChrome: 'pinned', footer: 'pinned' }}>
        <div>Body only</div>
      </ContentLayoutView>,
    );

    const layout = container.querySelector('[data-content-layout]');
    expect(layout?.getAttribute('data-has-chrome')).toBe('false');
    expect(container.querySelector('[data-content-body]')?.textContent).toContain('Body only');
  });
});
