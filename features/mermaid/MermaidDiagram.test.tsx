// @vitest-environment jsdom

import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { semanticThemes, type SemanticToken } from '@/components/core/design-tokens';
import { MermaidDiagram, type MermaidDiagramProps } from './MermaidDiagram';
import { getThemeDefinition, getThemeTokens, type ThemeId } from '@/lib/theme/themes';

const state = vi.hoisted(() => ({ themeId: 'light' as ThemeId, render: vi.fn() }));
vi.mock('@/lib/providers/DesignSystemProvider', () => ({
  useComputedColorScheme: () => getThemeDefinition(state.themeId).base,
  useColorScheme: () => ({ themeId: state.themeId, computedColorScheme: getThemeDefinition(state.themeId).base }),
}));
vi.mock('next-intl', () => ({ useLocale: () => 'en', useTranslations: () => (key: string) => key }));
vi.mock('./mermaid-renderer', () => ({ renderMermaid: state.render }));

interface AxeEngine {
  run: (
    context: HTMLElement,
    options: { runOnly: { type: 'rule'; values: string[] } },
  ) => Promise<{ violations: { id: string; nodes: unknown[] }[] }>;
}

async function runDiagramRules(context: HTMLElement) {
  // Use the same installed axe version as the Storybook addon, without a new dependency.
  const require = createRequire(import.meta.url);
  const addonRequire = createRequire(require.resolve('@storybook/addon-a11y/package.json'));
  const module = (await import(pathToFileURL(addonRequire.resolve('axe-core')).href)) as { default: AxeEngine };
  return module.default.run(context, {
    runOnly: {
      type: 'rule',
      values: ['aria-allowed-role', 'aria-valid-attr', 'aria-valid-attr-value', 'image-alt', 'image-redundant-alt'],
    },
  });
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.useFakeTimers();
  state.themeId = 'light';
  state.render.mockReset();
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

async function renderDiagram(props: Partial<MermaidDiagramProps> = {}) {
  await act(async () => {
    root.render(<MermaidDiagram source="flowchart LR\n A --> B" {...props} />);
  });
  await act(async () => vi.advanceTimersByTimeAsync(250));
}

describe('Mermaid mounted theme updates', () => {
  it('replaces an already rendered SVG with the selected theme without changing the source', async () => {
    state.render.mockImplementation(async (_source, theme) => ({ src: `data:image/svg+xml,${theme}`, width: 180 }));
    await renderDiagram();
    expect(container.querySelector('img')?.getAttribute('src')).toBe('data:image/svg+xml,light');
    const oldSignal = state.render.mock.calls[0][2] as AbortSignal;

    state.themeId = 'dark';
    await renderDiagram();
    expect(oldSignal.aborted).toBe(true);
    expect(container.querySelector('img')?.getAttribute('src')).toBe('data:image/svg+xml,dark');
    expect(state.render.mock.calls[1][0]).toBe(state.render.mock.calls[0][0]);
    expect(state.render.mock.calls[1][3]).toMatchObject({
      background: semanticThemes.dark.background,
      foreground: semanticThemes.dark['text-primary'],
      surface: semanticThemes.dark.surface,
    });
  });

  it('replaces computed SVG colors when a custom preset retains the same base scheme', async () => {
    const computedStyle = window.getComputedStyle.bind(window);
    vi.spyOn(window, 'getComputedStyle').mockImplementation((element, pseudoElement) => {
      const styles = computedStyle(element, pseudoElement);
      const role = (element as HTMLElement).style.color.match(/^var\(--geul-([\w-]+)\)$/)?.[1];
      return role ? ({ color: getThemeTokens(state.themeId)[role as SemanticToken] } as CSSStyleDeclaration) : styles;
    });
    state.render.mockImplementation(async (_source, _theme, _signal, appearance) => ({
      src: `data:image/svg+xml,${appearance.background}`,
      width: 180,
    }));
    await renderDiagram();
    const previousImage = container.querySelector('img')?.getAttribute('src');
    const previousSignal = state.render.mock.calls[0][2] as AbortSignal;
    state.themeId = 'ocean-light';
    await renderDiagram();
    expect(state.render).toHaveBeenCalledTimes(2);
    expect(state.render.mock.calls.map((call) => call[1])).toEqual(['light', 'light']);
    expect(state.render.mock.calls[1][0]).toBe(state.render.mock.calls[0][0]);
    expect(previousSignal.aborted).toBe(true);
    expect(state.render.mock.calls[1][3]).toMatchObject({
      background: getThemeTokens('ocean-light').background,
      border: getThemeTokens('ocean-light')['border-default'],
    });
    expect(container.querySelector('img')?.getAttribute('src')).not.toBe(previousImage);
    expect(container.querySelector('img')?.getAttribute('src')).toBe(
      `data:image/svg+xml,${getThemeTokens('ocean-light').background}`,
    );
  });

  it('ignores a late SVG from the previous theme after the new image has rendered', async () => {
    let resolveLight!: (image: { src: string }) => void;
    state.render.mockImplementation((_source, theme) =>
      theme === 'light'
        ? new Promise((resolve) => {
            resolveLight = resolve;
          })
        : Promise.resolve({ src: 'data:image/svg+xml,dark' }),
    );
    await renderDiagram();
    state.themeId = 'dark';
    await renderDiagram();
    expect(container.querySelector('img')?.getAttribute('src')).toBe('data:image/svg+xml,dark');
    await act(async () => resolveLight({ src: 'data:image/svg+xml,light' }));
    expect(container.querySelector('img')?.getAttribute('src')).toBe('data:image/svg+xml,dark');
  });
});

describe('Mermaid image accessibility', () => {
  it('passes actual host/role and image rules, while the former figure override fails the native host rule', async () => {
    state.render.mockResolvedValue({
      src: 'data:image/svg+xml,diagram',
      accessibleTitle: 'Draft review',
      accessibleDescription: 'Approved drafts publish; rejected drafts return.',
    });
    await renderDiagram({ title: 'Publication workflow' });
    vi.useRealTimers();
    expect(container.querySelector('[role="img"]')?.tagName).toBe('DIV');
    expect((await runDiagramRules(container)).violations).toEqual([]);

    const formerHost = document.createElement('figure');
    formerHost.setAttribute('role', 'img');
    formerHost.setAttribute('aria-label', 'Publication workflow');
    const formerCaption = document.createElement('figcaption');
    formerCaption.textContent = 'Publication workflow';
    formerHost.append(formerCaption);
    container.append(formerHost);
    const formerResult = await runDiagramRules(formerHost);
    expect(formerResult.violations.map((violation) => violation.id)).toContain('aria-allowed-role');
    formerHost.remove();
  });

  it('exposes a titled diagram once through its visible caption and retains the generated image', async () => {
    state.render.mockResolvedValue({ src: 'data:image/svg+xml,diagram', width: 180 });
    await renderDiagram({ title: '다이어그램' });
    const diagram = container.querySelector('[role="img"]')!;
    expect(diagram.tagName).toBe('DIV');
    expect(diagram).toHaveAttribute('role', 'img');
    expect(diagram).toHaveAttribute('data-mermaid-status', 'ready');
    expect(diagram).toHaveAccessibleName('다이어그램');
    expect(diagram).not.toHaveAttribute('aria-label');
    expect(container.querySelectorAll('[role="img"]')).toHaveLength(1);
    const caption = document.getElementById(diagram.getAttribute('aria-labelledby')!);
    expect(caption).toHaveTextContent('다이어그램');
    expect(diagram).toContainElement(caption);
    const pixels = diagram.querySelector('img')!;
    expect(pixels).toHaveAttribute('src', 'data:image/svg+xml,diagram');
    expect(pixels).toHaveAttribute('width', '180');
    expect(pixels).toHaveAttribute('alt', '');
    expect(pixels).not.toHaveAttribute('aria-hidden');
  });

  it("preserves an untitled diagram's authored accessibility title and description", async () => {
    state.render.mockResolvedValue({
      src: 'data:image/svg+xml,diagram',
      accessibleTitle: 'Draft review',
      accessibleDescription: 'Drafts move to review, then publication. Rejected drafts return to drafting.',
    });
    await renderDiagram();
    const diagram = container.querySelector('[role="img"]')!;
    expect(diagram).toHaveAccessibleName('Draft review');
    expect(diagram).toHaveAccessibleDescription(
      'Drafts move to review, then publication. Rejected drafts return to drafting.',
    );
    expect(diagram).not.toHaveAttribute('aria-labelledby');
  });

  it('retains a distinct authored title and description while the visible caption names the image', async () => {
    state.render.mockResolvedValue({
      src: 'data:image/svg+xml,diagram',
      accessibleTitle: 'Draft review and publication',
      accessibleDescription: 'Approved drafts are published; rejected drafts return to drafting.',
    });
    await renderDiagram({ title: 'Publication workflow' });
    const diagram = container.querySelector('[role="img"]')!;
    expect(diagram).toHaveAccessibleName('Publication workflow');
    expect(diagram).toHaveAccessibleDescription(
      'Draft review and publication Approved drafts are published; rejected drafts return to drafting.',
    );
  });

  it('does not repeat caption-equivalent authored metadata as a second description', async () => {
    state.render.mockResolvedValue({
      src: 'data:image/svg+xml,diagram',
      accessibleTitle: 'Publication\nworkflow',
      accessibleDescription: 'Publication workflow',
    });
    await renderDiagram({ title: 'Publication workflow' });
    const diagram = container.querySelector('[role="img"]')!;
    expect(diagram).toHaveAccessibleName('Publication workflow');
    expect(diagram).not.toHaveAttribute('aria-describedby');
    expect(diagram).toHaveAccessibleDescription('');
  });

  it('keeps loading and error messages exposed before an image exists', async () => {
    state.render.mockImplementationOnce(() => new Promise(() => {}));
    await renderDiagram();
    expect(container.querySelector('[role="figure"]')).toHaveAttribute('data-mermaid-status', 'loading');
    expect(container.querySelector('[role="status"]')).toHaveTextContent('loading');
    state.render.mockRejectedValueOnce(new Error('Invalid flowchart'));
    await renderDiagram({ source: 'flowchart LR\n A --> [' });
    expect(container.querySelector('[role="figure"]')).toHaveAttribute('data-mermaid-status', 'error');
    expect(container.querySelector('[role="alert"]')).toHaveTextContent('Invalid flowchart');
  });
});
