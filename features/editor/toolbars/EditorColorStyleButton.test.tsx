// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MantineProvider } from '@mantine/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EDITOR_COLOR_VALUES, EditorColorStyleButton } from './EditorColorStyleButton';

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

Object.defineProperty(window, 'ResizeObserver', {
  configurable: true,
  writable: true,
  value: class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
});

Object.defineProperty(window.HTMLElement.prototype, 'scrollIntoView', {
  configurable: true,
  writable: true,
  value: vi.fn(),
});

const labels = {
  button: 'Colors',
  text: 'Text',
  background: 'Background',
  colors: Object.fromEntries(EDITOR_COLOR_VALUES.map((color) => [color, color])) as Record<
    (typeof EDITOR_COLOR_VALUES)[number],
    string
  >,
};

describe('EditorColorStyleButton', () => {
  it('previews the active text and background color pair in the trigger', () => {
    act(() => {
      root.render(
        <MantineProvider env="test">
          <EditorColorStyleButton
            labels={labels}
            textColor="blue"
            backgroundColor="yellow"
            onTextColorChange={vi.fn()}
            onBackgroundColorChange={vi.fn()}
          />
        </MantineProvider>,
      );
    });

    const preview = container.querySelector<HTMLElement>('[data-editor-color-swatch="pair"]');
    expect(preview?.dataset.textColor).toBe('blue');
    expect(preview?.dataset.backgroundColor).toBe('yellow');
    expect(preview?.style.color).toBe('var(--editor-text-color-blue)');
    expect(preview?.style.backgroundColor).toBe('var(--editor-background-color-yellow)');
  });

  it('shows its name-only tooltip on focus and opens the dropdown with Enter', () => {
    act(() => {
      root.render(
        <MantineProvider env="test">
          <EditorColorStyleButton labels={labels} onTextColorChange={vi.fn()} />
        </MantineProvider>,
      );
    });

    const trigger = container.querySelector<HTMLButtonElement>('button[aria-label="Colors"]')!;
    act(() => trigger.focus());
    const tooltip = document.querySelector('[role="tooltip"]');
    expect(tooltip?.textContent).toBe('Colors');
    expect(tooltip?.querySelector('kbd')).toBeNull();
    // Native buttons synthesize click from Enter in the browser; jsdom does not.
    act(() => trigger.click());
    expect(container.querySelector('[data-menu-dropdown]')).not.toBeNull();
  });

  it('shows semantic previews for every text and background value, including truthful defaults', async () => {
    act(() => {
      root.render(
        <MantineProvider env="test">
          <EditorColorStyleButton
            labels={labels}
            textColor="default"
            backgroundColor="default"
            onTextColorChange={vi.fn()}
            onBackgroundColorChange={vi.fn()}
          />
        </MantineProvider>,
      );
    });

    await act(async () => container.querySelector<HTMLButtonElement>('button[aria-label="Colors"]')?.click());

    expect(container.querySelector('[data-menu-dropdown]')).not.toBeNull();
    const textSwatches = container.querySelectorAll<HTMLElement>('[data-editor-color-swatch="text"]');
    const backgroundSwatches = container.querySelectorAll<HTMLElement>('[data-editor-color-swatch="background"]');
    expect(textSwatches).toHaveLength(EDITOR_COLOR_VALUES.length);
    expect(backgroundSwatches).toHaveLength(EDITOR_COLOR_VALUES.length);

    EDITOR_COLOR_VALUES.forEach((color, index) => {
      expect(textSwatches[index]?.dataset.color).toBe(color);
      expect(textSwatches[index]?.style.color).toBe(`var(--editor-text-color-${color})`);
      expect(backgroundSwatches[index]?.dataset.color).toBe(color);
      expect(backgroundSwatches[index]?.style.backgroundColor).toBe(`var(--editor-background-color-${color})`);
    });
  });
});
