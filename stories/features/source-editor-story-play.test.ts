// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { getThemeTokens, themeIds, type ThemeId } from '@/lib/theme/themes';
import { sourceEditorTheme } from '@/features/editor/tiptap/code-editor/source-editor-presentation';

// Run the actual play assertions with the same default DOM wait behavior, without a manager.
vi.mock('storybook/test', async () => {
  const actual = await vi.importActual<typeof import('storybook/test')>('storybook/test');
  const { expect } = await import('vitest');
  return { ...actual, expect };
});

import { SyntaxContrast } from '@/features/editor/tiptap/code-editor/MonacoSourceEditor.stories';

const hosts: HTMLElement[] = [];
const originalThemeId = document.documentElement.dataset.geulThemeId;

function sourceFixture(themeId: ThemeId) {
  const host = document.createElement('div');
  const editor = document.createElement('div');
  const lines = document.createElement('div');
  editor.className = 'monaco-editor';
  lines.className = 'view-lines';
  const notation = ['//\u00a0Theme\u00a0colors\u00a0keep\u00a0source\u00a0notation\u00a0readable.', '42'];
  const leaves = [...notation, 'const', 'answer', '=', ';', 'if', '(', ')', '{', '}', 'Hello'].map((text) => {
    const leaf = document.createElement('span');
    leaf.textContent = text;
    lines.append(leaf);
    return leaf;
  });
  editor.append(lines);
  host.append(editor);
  document.body.append(host);
  hosts.push(host);
  const applyBackground = (id: ThemeId) => {
    editor.style.backgroundColor = sourceEditorTheme(id).colors['editor.background'];
  };
  const applyNotation = (id: ThemeId) => {
    const roles = getThemeTokens(id);
    for (const [index, leaf] of leaves.entries()) {
      leaf.style.color = index < 2 ? roles['document-text-green'] : roles['text-primary'];
    }
  };
  applyBackground(themeId);
  applyNotation(themeId);
  return { host, leaves, applyBackground, applyNotation };
}

function check(host: HTMLElement, theme: ThemeId) {
  const play = SyntaxContrast.play!;
  // The play reads only the canvas and globals; manager-only context is unused here.
  const context = { canvasElement: host, globals: { theme } } as unknown as Parameters<typeof play>[0];
  return Promise.resolve(play(context));
}

afterEach(() => {
  hosts.splice(0).forEach((host) => host.remove());
  if (originalThemeId === undefined) {
    delete document.documentElement.dataset.geulThemeId;
  } else {
    document.documentElement.dataset.geulThemeId = originalThemeId;
  }
});

describe('Source Editor Syntax Contrast play', () => {
  it.each(themeIds)('%s locates the actual NBSP comment and measures notation', async (themeId) => {
    document.documentElement.dataset.geulThemeId = themeId;
    const fixture = sourceFixture(themeId);
    await check(fixture.host, themeId);
  });

  it('awaits the requested preset, delayed Monaco background and replaced notation after a toolbar switch', async () => {
    document.documentElement.dataset.geulThemeId = 'light';
    const fixture = sourceFixture('light');
    let completed = false;
    const result = check(fixture.host, 'ocean-dark').then(() => {
      completed = true;
    });
    await new Promise<void>((resolve) => setTimeout(resolve, 10));
    expect(completed).toBe(false);
    document.documentElement.dataset.geulThemeId = 'ocean-dark';
    await new Promise<void>((resolve) => setTimeout(resolve, 10));
    expect(completed).toBe(false);
    fixture.applyBackground('ocean-dark');
    await new Promise<void>((resolve) => setTimeout(resolve, 10));
    expect(completed).toBe(false);
    // Monaco may replace token nodes when its theme or tokenizer finishes.
    for (const [index, leaf] of fixture.leaves.entries()) {
      const replacement = leaf.cloneNode(true) as HTMLElement;
      leaf.replaceWith(replacement);
      fixture.leaves[index] = replacement;
    }
    fixture.applyNotation('ocean-dark');
    await result;
    expect(completed).toBe(true);
  });

  it('still rejects a persistent token with insufficient actual contrast', async () => {
    document.documentElement.dataset.geulThemeId = 'light';
    const fixture = sourceFixture('light');
    fixture.leaves[3].style.color = sourceEditorTheme('light').colors['editor.background'];
    await expect(check(fixture.host, 'light')).rejects.toThrow(/greater than or equal to 4.5/);
  });
});
