// @vitest-environment jsdom

import { DesignSystemProvider } from '@/lib/providers/DesignSystemProvider';
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';

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
  vi.useRealTimers();
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
  it('previews active text and background independently in distinct triggers', () => {
    act(() => {
      root.render(
        <DesignSystemProvider forceColorScheme="light">
          <EditorColorStyleButton
            labels={labels}
            textColor="blue"
            backgroundColor="yellow"
            onTextColorChange={vi.fn()}
            onBackgroundColorChange={vi.fn()}
          />
        </DesignSystemProvider>,
      );
    });

    const text = container.querySelector<HTMLElement>('button[aria-label="Text"] [data-editor-color-swatch="text"]')!;
    const background = container.querySelector<HTMLElement>(
      'button[aria-label="Background"] [data-editor-color-swatch="background"]',
    )!;
    expect(text.dataset.color).toBe('blue');
    expect(text.style.color).toBe('var(--editor-text-color-blue)');
    expect(text.style.backgroundColor).toBe('var(--editor-background-color-default)');
    expect(background.dataset.color).toBe('yellow');
    expect(background.style.color).toBe('var(--editor-text-color-default)');
    expect(background.style.backgroundColor).toBe('var(--editor-background-color-yellow)');
  });

  it('keeps focus hints suppressed and opens the accessible dropdown by keyboard', async () => {
    act(() => {
      root.render(
        <DesignSystemProvider forceColorScheme="light">
          <EditorColorStyleButton labels={labels} onTextColorChange={vi.fn()} />
        </DesignSystemProvider>,
      );
    });

    const trigger = container.querySelector<HTMLButtonElement>('button[aria-label="Text"]')!;
    act(() => trigger.focus());
    expect(document.activeElement).toBe(trigger);
    expect(document.querySelector('[role="tooltip"]')).toBeNull();
    expect(trigger.type).toBe('button');
    vi.useFakeTimers();
    await act(async () => trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })));
    await act(() => vi.advanceTimersByTimeAsync(35));
    expect(container.querySelector('[data-menu-dropdown]')).not.toBeNull();
    expect(document.activeElement).toBe(container.querySelector('[role="menuitem"]'));
    expect(document.querySelector('[role="tooltip"]')).toBeNull();
  });

  it('shows semantic previews for every text and background value, including truthful defaults', async () => {
    act(() => {
      root.render(
        <DesignSystemProvider forceColorScheme="light">
          <EditorColorStyleButton
            labels={labels}
            textColor="default"
            backgroundColor="default"
            onTextColorChange={vi.fn()}
            onBackgroundColorChange={vi.fn()}
          />
        </DesignSystemProvider>,
      );
    });

    await act(async () => container.querySelector<HTMLButtonElement>('button[aria-label="Text"]')?.click());

    let menu = container.querySelector<HTMLElement>('[role="menu"]')!;
    expect(menu.querySelector('[role="group"]')?.getAttribute('aria-label')).toBe(labels.text);
    const textSwatches = menu.querySelectorAll<HTMLElement>('[data-editor-color-swatch="text"]');
    expect(textSwatches).toHaveLength(EDITOR_COLOR_VALUES.length);
    expect(menu.querySelector('[data-editor-color-swatch="background"]')).toBeNull();
    EDITOR_COLOR_VALUES.forEach((color, index) => {
      expect(textSwatches[index]?.dataset.color).toBe(color);
      expect(textSwatches[index]?.style.color).toBe(`var(--editor-text-color-${color})`);
    });
    await act(async () => menu.querySelector<HTMLElement>('[data-test="text-color-default"]')!.click());
    await act(async () => container.querySelector<HTMLButtonElement>('button[aria-label="Background"]')!.click());
    menu = container.querySelector<HTMLElement>('[role="menu"]')!;
    expect(menu.querySelector('[role="group"]')?.getAttribute('aria-label')).toBe(labels.background);
    const backgroundSwatches = menu.querySelectorAll<HTMLElement>('[data-editor-color-swatch="background"]');
    expect(backgroundSwatches).toHaveLength(EDITOR_COLOR_VALUES.length);
    expect(menu.querySelector('[data-editor-color-swatch="text"]')).toBeNull();
    EDITOR_COLOR_VALUES.forEach((color, index) => {
      expect(backgroundSwatches[index]?.dataset.color).toBe(color);
      expect(backgroundSwatches[index]?.style.backgroundColor).toBe(`var(--editor-background-color-${color})`);
    });
  });

  it('keeps selected durable colors while the site changes between light and dark', async () => {
    const onTextColorChange = vi.fn();
    function SelectedColors() {
      const [textColor, setTextColor] = useState<(typeof EDITOR_COLOR_VALUES)[number]>('blue');
      return (
        <EditorColorStyleButton
          labels={labels}
          textColor={textColor}
          backgroundColor="yellow"
          onTextColorChange={(color) => {
            onTextColorChange(color);
            setTextColor(color);
          }}
          onBackgroundColorChange={vi.fn()}
        />
      );
    }
    await act(async () => {
      root.render(
        <DesignSystemProvider forceColorScheme="light">
          <SelectedColors />
        </DesignSystemProvider>,
      );
    });
    await act(async () => container.querySelector<HTMLButtonElement>('button[aria-label="Text"]')!.click());
    await act(async () => container.querySelector<HTMLElement>('[data-test="text-color-purple"]')!.click());
    expect(onTextColorChange).toHaveBeenCalledExactlyOnceWith('purple');
    const preview = container.querySelector<HTMLElement>(
      'button[aria-label="Text"] [data-editor-color-swatch="text"]',
    )!;
    expect(preview.dataset.color).toBe('purple');
    expect(
      container.querySelector<HTMLElement>('button[aria-label="Background"] [data-editor-color-swatch]')?.dataset.color,
    ).toBe('yellow');
    expect(document.documentElement.dataset.geulTheme).toBe('light');

    await act(async () => {
      root.render(
        <DesignSystemProvider forceColorScheme="dark">
          <SelectedColors />
        </DesignSystemProvider>,
      );
    });
    expect(document.documentElement.dataset.geulTheme).toBe('dark');
    expect(preview.dataset.color).toBe('purple');
    expect(
      container.querySelector<HTMLElement>('button[aria-label="Background"] [data-editor-color-swatch]')?.dataset.color,
    ).toBe('yellow');
    expect(preview.style.color).toBe('var(--editor-text-color-purple)');
    expect(preview.style.backgroundColor).toBe('var(--editor-background-color-default)');
    expect(onTextColorChange).toHaveBeenCalledTimes(1);
  });
});
