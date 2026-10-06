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
vi.mock('../usePageSectionTypeLabels', () => ({
  usePageSectionTypeLabels: () => ({ 'rich-text': 'Text', embed: 'Embed' }),
}));

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
  it('configures Embed before adding a column child and leaves cancelled or invalid input unsaved', () => {
    state.editable = true;
    state.allowStructuralEdits = true;
    const view = render(
      <MantineProvider env="test">
        <ColumnsEditor section={section} SectionRenderer={() => <div>Child content</div>} />
      </MantineProvider>,
    );
    const open = () => {
      act(() => view.container.querySelector<HTMLButtonElement>('[data-column-section-add="0"]')?.click());
      act(() => document.querySelector<HTMLButtonElement>('[data-column-section-add-item="embed"]')?.click());
    };
    open();
    expect(state.updateSection).not.toHaveBeenCalled();
    act(() => document.querySelector<HTMLButtonElement>('[data-page-section-preinsert-cancel]')?.click());
    expect(state.updateSection).not.toHaveBeenCalled();
    open();
    const input = document.querySelector<HTMLInputElement>('[data-page-section-preinsert-url]')!;
    const confirm = document.querySelector<HTMLButtonElement>('[data-page-section-preinsert-confirm]')!;
    const typeUri = (value: string) =>
      act(() => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, value);
        input.dispatchEvent(new Event('input', { bubbles: true }));
      });
    typeUri('http://embed.example/app');
    expect(confirm.disabled).toBe(true);
    act(() => confirm.click());
    expect(state.updateSection).not.toHaveBeenCalled();
    typeUri('https://embed.example/app');
    expect(confirm.disabled).toBe(false);
    act(() => confirm.click());
    expect(state.updateSection).toHaveBeenCalledOnce();
    expect(state.updateSection).toHaveBeenCalledWith('columns', {
      columns: [
        expect.objectContaining({
          id: 'column-a',
          sections: [
            section.columns[0]!.sections[0],
            expect.objectContaining({
              type: 'embed',
              props: expect.objectContaining({ uri: 'https://embed.example/app' }),
            }),
          ],
        }),
        section.columns[1],
      ],
    });
  });

  it.each(['reorder', 'remove'] as const)(
    'keeps pending Embed insertion attached to its column after remote %s',
    (change) => {
      state.editable = true;
      state.allowStructuralEdits = true;
      const editor = (currentSection: ColumnsSection) => (
        <MantineProvider env="test">
          <ColumnsEditor section={currentSection} SectionRenderer={() => <div>Child content</div>} />
        </MantineProvider>
      );
      const view = render(editor(section));
      act(() => view.container.querySelector<HTMLButtonElement>('[data-column-section-add="0"]')?.click());
      act(() => document.querySelector<HTMLButtonElement>('[data-column-section-add-item="embed"]')?.click());
      const input = document.querySelector<HTMLInputElement>('[data-page-section-preinsert-url]')!;
      act(() => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(
          input,
          'https://embed.example/app',
        );
        input.dispatchEvent(new Event('input', { bubbles: true }));
      });
      const changedSection = {
        ...section,
        columns: change === 'reorder' ? [section.columns[1]!, section.columns[0]!] : [section.columns[1]!],
      };
      act(() => root!.render(editor(changedSection)));
      act(() => document.querySelector<HTMLButtonElement>('[data-page-section-preinsert-confirm]')?.click());
      if (change === 'remove') {
        expect(state.updateSection).not.toHaveBeenCalled();
      } else {
        expect(state.updateSection).toHaveBeenCalledExactlyOnceWith('columns', {
          columns: [
            section.columns[1],
            expect.objectContaining({
              id: 'column-a',
              sections: [
                section.columns[0]!.sections[0],
                expect.objectContaining({
                  type: 'embed',
                  props: expect.objectContaining({ uri: 'https://embed.example/app' }),
                }),
              ],
            }),
          ],
        });
      }
    },
  );

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
