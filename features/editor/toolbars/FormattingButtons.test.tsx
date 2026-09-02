// @vitest-environment jsdom

import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MantineProvider } from '@mantine/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StandardFormattingButtons } from './FormattingButtons';

let container: HTMLDivElement | null = null;
let root: Root | null = null;

beforeEach(() => {
  vi.spyOn(window.navigator, 'platform', 'get').mockReturnValue('Win32');
  vi.spyOn(window.navigator, 'maxTouchPoints', 'get').mockReturnValue(0);
});

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  container = null;
  root = null;
  vi.restoreAllMocks();
});

function render(node: ReactNode) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root?.render(<MantineProvider env="test">{node}</MantineProvider>));
}

const labels = {
  bold: 'Bold',
  italic: 'Italic',
  underline: 'Underline',
  strike: 'Strike',
  code: 'Code',
  link: 'Create link',
  nest: 'Nest',
  unnest: 'Unnest',
  alignment: 'Alignment',
};

describe('StandardFormattingButtons', () => {
  it('uses the verified selection-menu order, including code before alignment', () => {
    render(
      <StandardFormattingButtons
        labels={labels}
        blockType={{ label: 'Block type', value: 'paragraph', options: [], onChange: vi.fn() }}
        alignment={{
          value: 'left',
          labels: { left: 'Align left', center: 'Align center', right: 'Align right' },
          onChange: vi.fn(),
        }}
        color={{
          labels: {
            button: 'Colors',
            text: 'Text',
            background: 'Background',
            colors: {
              default: 'Default',
              gray: 'Gray',
              brown: 'Brown',
              red: 'Red',
              orange: 'Orange',
              yellow: 'Yellow',
              green: 'Green',
              blue: 'Blue',
              purple: 'Purple',
              pink: 'Pink',
            },
          },
          textColor: 'default',
          onTextColorChange: vi.fn(),
        }}
        activeTextStyles={new Set(['code'])}
        onToggleTextStyle={vi.fn()}
        onNestBlock={vi.fn()}
        onUnnestBlock={vi.fn()}
        onCreateLink={vi.fn()}
      />,
    );

    expect(
      [...container!.querySelectorAll<HTMLButtonElement>('button')].map((button) => button.getAttribute('aria-label')),
    ).toEqual([
      'Block type',
      'Bold',
      'Italic',
      'Underline',
      'Strike',
      'Code',
      'Align left',
      'Align center',
      'Align right',
      'Colors',
      'Nest',
      'Unnest',
      'Create link',
    ]);
    expect(container?.querySelectorAll('[role="group"][aria-label="Alignment"]')).toHaveLength(1);
    expect(container?.querySelector<HTMLButtonElement>('button[aria-label="Code"]')?.getAttribute('aria-pressed')).toBe(
      'true',
    );
  });

  it('keeps CellSelection alignment enabled while text styling and nesting are disabled', () => {
    const onChange = vi.fn();
    render(
      <StandardFormattingButtons
        labels={labels}
        alignment={{
          value: 'center',
          labels: { left: 'Align left', center: 'Align center', right: 'Align right' },
          onChange,
        }}
        onToggleTextStyle={vi.fn()}
        textStylesDisabled
        onNestBlock={vi.fn()}
        nestDisabled
        onUnnestBlock={vi.fn()}
        unnestDisabled
      />,
    );

    expect(container?.querySelector<HTMLButtonElement>('button[aria-label="Bold"]')?.disabled).toBe(true);
    expect(container?.querySelector<HTMLButtonElement>('button[aria-label="Nest"]')?.disabled).toBe(true);
    expect(container?.querySelector<HTMLButtonElement>('button[aria-label="Unnest"]')?.disabled).toBe(true);
    const alignRight = container?.querySelector<HTMLButtonElement>('button[aria-label="Align right"]');
    expect(alignRight?.disabled).toBe(false);
    act(() => alignRight?.click());
    expect(onChange).toHaveBeenCalledWith('right');
  });

  it('does not mark an alignment pressed when selected targets have mixed values', () => {
    render(
      <StandardFormattingButtons
        labels={labels}
        alignment={{
          value: null,
          labels: { left: 'Align left', center: 'Align center', right: 'Align right' },
          onChange: vi.fn(),
        }}
      />,
    );

    expect([...container!.querySelectorAll<HTMLButtonElement>('[role="group"] button')]).toHaveLength(3);
    expect(container!.querySelectorAll('[role="group"] button[aria-pressed="true"]')).toHaveLength(0);
  });

  it('shows the verified mark shortcut but no invented link shortcut on keyboard focus', () => {
    render(
      <StandardFormattingButtons
        labels={labels}
        textStyles={['strike']}
        onToggleTextStyle={vi.fn()}
        onCreateLink={vi.fn()}
      />,
    );
    const strike = container!.querySelector<HTMLButtonElement>('button[aria-label="Strike"]')!;
    act(() => strike.focus());
    expect(
      [...document.querySelectorAll<HTMLElement>('[data-editor-toolbar-tooltip-content]')]
        .find((content) => content.textContent?.startsWith('Strike'))
        ?.querySelector('kbd')?.textContent,
    ).toBe('Ctrl Shift S');

    const link = container!.querySelector<HTMLButtonElement>('button[aria-label="Create link"]')!;
    act(() => link.focus());
    expect(
      [...document.querySelectorAll<HTMLElement>('[data-editor-toolbar-tooltip-content]')]
        .find((content) => content.textContent === 'Create link')
        ?.querySelector('kbd'),
    ).toBeNull();
  });

  it('keeps block-type DropdownMenu behavior on the direct native button trigger', () => {
    const onChange = vi.fn();
    render(
      <StandardFormattingButtons
        labels={labels}
        blockType={{
          label: 'Block type',
          value: 'paragraph',
          options: [
            { value: 'paragraph', label: 'Paragraph' },
            { value: 'heading-1', label: 'Heading 1' },
          ],
          onChange,
        }}
      />,
    );
    const trigger = container!.querySelector<HTMLButtonElement>('button[aria-label="Block type"]')!;
    expect(trigger.tagName).toBe('BUTTON');
    expect(trigger.getAttribute('aria-haspopup')).toBe('menu');
    act(() => trigger.focus());
    expect(document.querySelector('[role="tooltip"]')?.textContent).toBe('Block type');
    act(() => trigger.click());
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    const heading = [...document.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')].find(
      (item) => item.textContent === 'Heading 1',
    )!;
    act(() => heading.click());
    expect(onChange).toHaveBeenCalledWith('heading-1');
  });

  it('labels every direct alignment action with the shared cycle-pair hint', () => {
    render(
      <StandardFormattingButtons
        labels={labels}
        alignment={{
          value: 'left',
          labels: { left: 'Align left', center: 'Align center', right: 'Align right' },
          onChange: vi.fn(),
        }}
      />,
    );
    for (const label of ['Align left', 'Align center', 'Align right']) {
      const action = container!.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!;
      act(() => action.focus());
      const content = [...document.querySelectorAll<HTMLElement>('[data-editor-toolbar-tooltip-content]')].find(
        (item) => item.textContent?.startsWith(label),
      );
      expect(content?.querySelector('kbd')?.textContent).toBe('Ctrl ⇧ ←/→');
    }
  });
});
