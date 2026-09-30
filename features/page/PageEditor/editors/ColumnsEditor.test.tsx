// @vitest-environment jsdom

import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MantineProvider } from '@mantine/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ColumnsEditor } from './ColumnsEditor';
import type { ColumnsSection } from '../types';

const state = vi.hoisted(() => ({ editable: false, allowStructuralEdits: false, updateSection: vi.fn() }));
vi.mock('../PageEditorContext', () => ({ usePageEditor: () => state }));
vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
vi.mock('../usePageSectionTypeLabels', () => ({ usePageSectionTypeLabels: () => ({ 'rich-text': 'Text' }) }));

let root: Root | null = null;
let container: HTMLDivElement;
function render(element: ReactNode) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root!.render(element));
  return {
    container,
    getByText: (text: string) => [...container.querySelectorAll('*')].find((node) => node.textContent === text),
    queryByText: (text: string) =>
      [...container.querySelectorAll('*')].find((node) => node.textContent === text) ?? null,
  };
}
function cleanup() {
  act(() => root?.unmount());
  container?.remove();
  root = null;
}

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
});
globalThis.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
afterEach(() => {
  cleanup();
  state.updateSection.mockClear();
});

describe('ColumnsEditor authority', () => {
  const section = {
    id: 'columns',
    type: 'columns',
    props: { columns: '2' },
    columns: [
      { id: 'column-a', sections: [{ id: 'text', type: 'rich-text' }] },
      { id: 'column-b', sections: [] },
    ],
  } as ColumnsSection;
  it.each([
    [false, true],
    [true, false],
  ])('disables topology controls with editable=%s and structural authority=%s', (editable, allowStructuralEdits) => {
    state.editable = editable;
    state.allowStructuralEdits = allowStructuralEdits;
    const view = render(
      <MantineProvider env="test">
        <ColumnsEditor section={section} SectionRenderer={() => <div>Child content</div>} />
      </MantineProvider>,
    );
    expect(view.getByText('Child content')).toBeTruthy();
    for (const control of view.container.querySelectorAll<HTMLInputElement | HTMLButtonElement>('input, button')) {
      expect(control.disabled).toBe(true);
      act(() => control.click());
    }
    expect(state.updateSection).not.toHaveBeenCalled();
  });
});
