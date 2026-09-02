// @vitest-environment jsdom

import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { MantineProvider } from '@mantine/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DropdownMenu } from '@/components/core/DropdownMenu';
import {
  EDITOR_TOOLBAR_ALIGNMENT_CYCLE_SHORTCUTS,
  EditorToolbarDropdownTarget,
  EDITOR_TOOLBAR_SHORTCUTS,
  EditorToolbarTooltip,
  EditorToolbarTooltipContent,
  formatEditorToolbarShortcut,
  formatEditorToolbarShortcutHint,
} from './EditorToolbarTooltip';

let container: HTMLDivElement | null = null;
let root: Root | null = null;

beforeEach(() => {
  vi.spyOn(window.navigator, 'platform', 'get').mockReturnValue('Win32');
  Object.defineProperty(window.navigator, 'maxTouchPoints', { configurable: true, value: 0 });
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

describe('EditorToolbarTooltip', () => {
  it('renders only the exact verified editor shortcut mappings', () => {
    expect(EDITOR_TOOLBAR_SHORTCUTS).toEqual({
      bold: 'Mod-b',
      italic: 'Mod-i',
      underline: 'Mod-u',
      strike: 'Mod-Shift-s',
      code: 'Mod-e',
      ai: 'Mod-j',
      apply: 'Mod-Enter',
      suggestions: 'Mod-Space',
    });
    render(
      <>
        {Object.entries(EDITOR_TOOLBAR_SHORTCUTS).map(([name, shortcut]) => (
          <EditorToolbarTooltipContent key={name} label={name} shortcut={shortcut} />
        ))}
        <EditorToolbarTooltipContent label="Align left" />
        <EditorToolbarTooltipContent label="Create link" />
        <EditorToolbarTooltipContent label="Inline math" />
        <EditorToolbarTooltipContent label="Colors" />
      </>,
    );
    expect([...container!.querySelectorAll('kbd')].map((item) => item.textContent)).toEqual([
      'Ctrl B',
      'Ctrl I',
      'Ctrl U',
      'Ctrl Shift S',
      'Ctrl E',
      'Ctrl J',
      'Ctrl ↵',
      'Ctrl Space',
    ]);
    expect(container!.querySelectorAll('[data-editor-toolbar-tooltip-content]')).toHaveLength(12);
  });

  it('opens on keyboard focus without replacing the action accessible name', () => {
    render(
      <EditorToolbarTooltip label="Bold" shortcut={EDITOR_TOOLBAR_SHORTCUTS.bold}>
        <button type="button" aria-label="Bold">
          B
        </button>
      </EditorToolbarTooltip>,
    );
    const button = container!.querySelector<HTMLButtonElement>('button')!;
    act(() => button.focus());
    expect(button.getAttribute('aria-label')).toBe('Bold');
    const tooltip = document.querySelector<HTMLElement>('[role="tooltip"]');
    expect(tooltip?.textContent).toBe('BoldCtrl B');
    expect(tooltip?.className).toContain('tooltip');
    const shortcut = tooltip?.querySelector('kbd');
    expect(shortcut?.className).toContain('shortcut');
    expect(shortcut?.getAttribute('role')).toBeNull();
  });

  it('omits a shortcut element when no direct command exists', () => {
    render(<EditorToolbarTooltipContent label="Align center" />);
    expect(container!.querySelector('[data-editor-toolbar-tooltip-content]')?.textContent).toBe('Align center');
    expect(container!.querySelector('kbd')).toBeNull();
  });

  it('formats Mod semantics for macOS, iPadOS, and Windows without rewriting explicit Ctrl', () => {
    const mac = { platform: 'MacIntel', maxTouchPoints: 0 };
    const ipad = { platform: 'MacIntel', maxTouchPoints: 5 };
    const windows = { platform: 'Win32', maxTouchPoints: 0 };
    expect(formatEditorToolbarShortcut(EDITOR_TOOLBAR_SHORTCUTS.bold, mac)).toBe('⌘ B');
    expect(formatEditorToolbarShortcut(EDITOR_TOOLBAR_SHORTCUTS.strike, mac)).toBe('⌘ ⇧ S');
    expect(formatEditorToolbarShortcut(EDITOR_TOOLBAR_SHORTCUTS.bold, ipad)).toBe('⌘ B');
    expect(formatEditorToolbarShortcut(EDITOR_TOOLBAR_SHORTCUTS.apply, mac)).toBe('⌘ ↵');
    expect(formatEditorToolbarShortcut(EDITOR_TOOLBAR_SHORTCUTS.suggestions, windows)).toBe('Ctrl Space');
    expect(formatEditorToolbarShortcut(EDITOR_TOOLBAR_SHORTCUTS.strike, windows)).toBe('Ctrl Shift S');
    expect(formatEditorToolbarShortcut(EDITOR_TOOLBAR_ALIGNMENT_CYCLE_SHORTCUTS[0], mac)).toBe('Ctrl ⇧ ←');
    expect(formatEditorToolbarShortcutHint(EDITOR_TOOLBAR_ALIGNMENT_CYCLE_SHORTCUTS, mac)).toBe('Ctrl ⇧ ←/→');
    expect(formatEditorToolbarShortcutHint(EDITOR_TOOLBAR_ALIGNMENT_CYCLE_SHORTCUTS, windows)).toBe('Ctrl ⇧ ←/→');
  });

  it('renders the Apple shortcut after the client platform effect', () => {
    vi.restoreAllMocks();
    vi.spyOn(window.navigator, 'platform', 'get').mockReturnValue('MacIntel');
    Object.defineProperty(window.navigator, 'maxTouchPoints', { configurable: true, value: 5 });
    render(<EditorToolbarTooltipContent label="Strike" shortcut={EDITOR_TOOLBAR_SHORTCUTS.strike} />);
    expect(container!.querySelector('kbd')?.textContent).toBe('⌘ ⇧ S');
  });

  it('omits shortcut markup on the server so hydration starts from the same client render', () => {
    const html = renderToString(<EditorToolbarTooltipContent label="Bold" shortcut={EDITOR_TOOLBAR_SHORTCUTS.bold} />);
    expect(html).toContain('Bold');
    expect(html).not.toContain('<kbd');
    expect(html).not.toContain('Mod-b');
  });

  it('keeps DropdownMenu ownership on the real button while focus tooltip observes it by ref', () => {
    render(
      <DropdownMenu portal={false}>
        <EditorToolbarDropdownTarget label="Block type">
          {(targetRef) => (
            <button ref={targetRef} type="button" aria-label="Block type">
              Block
            </button>
          )}
        </EditorToolbarDropdownTarget>
        <DropdownMenu.Dropdown>
          <DropdownMenu.Item>Paragraph</DropdownMenu.Item>
        </DropdownMenu.Dropdown>
      </DropdownMenu>,
    );
    const button = container!.querySelector<HTMLButtonElement>('button[aria-label="Block type"]')!;
    expect(button.getAttribute('aria-haspopup')).toBe('menu');
    act(() => button.focus());
    expect(document.querySelector('[role="tooltip"]')?.textContent).toBe('Block type');
    act(() => button.click());
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(document.querySelector('[role="menuitem"]')?.textContent).toBe('Paragraph');
  });

  it('opens and closes a ref-target tooltip from native focus and pointer listeners', () => {
    vi.useFakeTimers();
    try {
      render(
        <DropdownMenu portal={false}>
          <EditorToolbarDropdownTarget label="Places">
            {(targetRef) => (
              <button ref={targetRef} type="button" aria-label="Places">
                Places
              </button>
            )}
          </EditorToolbarDropdownTarget>
          <DropdownMenu.Dropdown>
            <DropdownMenu.Item>Place</DropdownMenu.Item>
          </DropdownMenu.Dropdown>
        </DropdownMenu>,
      );
      const button = container!.querySelector<HTMLButtonElement>('button[aria-label="Places"]')!;
      act(() => button.dispatchEvent(new FocusEvent('focusin', { bubbles: true })));
      expect(document.querySelector('[role="tooltip"]')?.textContent).toBe('Places');
      act(() => {
        button.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
        vi.runAllTimers();
      });
      expect(document.querySelector('[role="tooltip"]')).toBeNull();

      act(() => button.dispatchEvent(new MouseEvent('mouseenter')));
      expect(document.querySelector('[role="tooltip"]')?.textContent).toBe('Places');
      act(() => {
        button.dispatchEvent(new MouseEvent('mouseleave'));
        vi.runAllTimers();
      });
      expect(document.querySelector('[role="tooltip"]')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});
