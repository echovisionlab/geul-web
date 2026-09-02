// @vitest-environment jsdom

import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TestProviders } from '@/test/TestProviders';
import { ContentLayoutField } from './ContentLayoutField';
import { DEFAULT_DOCUMENT_LAYOUT, type DocumentLayout } from './types';

const labels = {
  contentHeight: 'Content height',
  content: 'Content',
  viewport: 'Viewport',
  pageChrome: 'Content chrome',
  footer: 'Footer',
  flow: 'Flow',
  pinned: 'Pinned',
};

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function Fixture() {
  const [value, setValue] = useState<DocumentLayout>(DEFAULT_DOCUMENT_LAYOUT);
  return <ContentLayoutField value={value} onChange={setValue} labels={labels} />;
}

function render(node: React.ReactNode) {
  act(() => root.render(<TestProviders>{node}</TestProviders>));
}

describe('ContentLayoutField', () => {
  it('updates the shared layout controls independently', () => {
    render(<Fixture />);

    const viewport = container.querySelector<HTMLInputElement>('input[value="viewport"]');
    const pinned = Array.from(container.querySelectorAll<HTMLInputElement>('input[value="pinned"]'));
    act(() => viewport?.click());
    act(() => pinned[0]?.click());
    act(() => pinned[1]?.click());

    expect(viewport?.checked).toBe(true);
    expect(pinned[0]?.checked).toBe(true);
    expect(pinned[1]?.checked).toBe(true);
  });

  it('maps view changes back to the public DocumentLayout contract', () => {
    const onChange = vi.fn<(value: DocumentLayout) => void>();
    render(<ContentLayoutField value={DEFAULT_DOCUMENT_LAYOUT} onChange={onChange} labels={labels} />);

    act(() => container.querySelector<HTMLInputElement>('input[value="viewport"]')?.click());

    expect(onChange).toHaveBeenCalledWith({
      contentHeight: 'viewport',
      pageChrome: 'flow',
      footer: 'flow',
    } satisfies DocumentLayout);
  });
});
