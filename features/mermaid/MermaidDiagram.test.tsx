// @vitest-environment jsdom

import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { act } from 'react';
import { render, screen } from '@/test/render';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { semanticThemes, type SemanticToken } from '@echovisionlab/design-system/tokens';
import { MermaidDiagram, type MermaidDiagramProps } from './MermaidDiagram';
import { getThemeDefinition, getThemeTokens, type ThemeId } from '@/lib/theme/themes';

const state = vi.hoisted(() => ({ themeId: 'light' as ThemeId, render: vi.fn() }));
vi.mock('@/lib/providers/DesignSystemProvider', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/providers/DesignSystemProvider')>()),
  useComputedColorScheme: () => getThemeDefinition(state.themeId).base,
  useColorScheme: () => ({ themeId: state.themeId, computedColorScheme: getThemeDefinition(state.themeId).base }),
}));
vi.mock('next-intl', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next-intl')>()),
  useLocale: () => 'en',
  useTranslations: () => (key: string) => key,
}));
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

let view: ReturnType<typeof render> | undefined;

beforeEach(() => {
  vi.useFakeTimers();
  state.themeId = 'light';
  state.render.mockReset();
  view = undefined;
});

afterEach(() => {
  view?.unmount();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

async function renderDiagram(props: Partial<MermaidDiagramProps> = {}) {
  const element = <MermaidDiagram source="flowchart LR\n A --> B" {...props} />;
  if (view) {
    view.rerender(element);
  } else {
    view = render(element);
  }
  await act(async () => vi.advanceTimersByTimeAsync(250));
}

describe('Mermaid mounted theme updates', () => {
  it('replaces an already rendered SVG with the selected theme without changing the source', async () => {
    state.render.mockImplementation(async (_source, theme) => ({ src: `data:image/svg+xml,${theme}`, width: 180 }));
    await renderDiagram();
    expect(screen.getByAltText('')?.getAttribute('src')).toBe('data:image/svg+xml,light');
    const oldSignal = state.render.mock.calls[0][2] as AbortSignal;

    state.themeId = 'dark';
    await renderDiagram();
    expect(oldSignal.aborted).toBe(true);
    expect(screen.getByAltText('')?.getAttribute('src')).toBe('data:image/svg+xml,dark');
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
    const previousImage = screen.getByAltText('')?.getAttribute('src');
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
    expect(screen.getByAltText('')?.getAttribute('src')).not.toBe(previousImage);
    expect(screen.getByAltText('')?.getAttribute('src')).toBe(
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
    expect(screen.getByAltText('')?.getAttribute('src')).toBe('data:image/svg+xml,dark');
    await act(async () => resolveLight({ src: 'data:image/svg+xml,light' }));
    expect(screen.getByAltText('')?.getAttribute('src')).toBe('data:image/svg+xml,dark');
  });
});

it('keeps the previous diagram visible while rendering a new source and shows shared loading on the first render', async () => {
  let resolveFirst!: (image: { src: string }) => void;
  let resolveNext!: (image: { src: string }) => void;
  state.render.mockReturnValueOnce(
    new Promise((resolve) => {
      resolveFirst = resolve;
    }),
  );
  await renderDiagram();
  expect(screen.getByRole('status')).toHaveTextContent('loading');
  await act(async () => resolveFirst({ src: 'data:image/svg+xml,first' }));
  state.render.mockReturnValueOnce(
    new Promise((resolve) => {
      resolveNext = resolve;
    }),
  );
  await renderDiagram({ source: 'flowchart LR\n A --> C' });
  expect(screen.getByAltText('')).toHaveAttribute('src', 'data:image/svg+xml,first');
  expect(screen.getByRole('figure')).toHaveAttribute('aria-busy', 'true');
  expect(screen.getByRole('status')).toHaveTextContent('loading');
  await act(async () => resolveNext({ src: 'data:image/svg+xml,next' }));
  expect(screen.getByAltText('')).toHaveAttribute('src', 'data:image/svg+xml,next');
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
});

describe('Mermaid image accessibility', () => {
  it('passes host/role and image rules on the rendered diagram', async () => {
    state.render.mockResolvedValue({
      src: 'data:image/svg+xml,diagram',
      accessibleTitle: 'Draft review',
      accessibleDescription: 'Approved drafts publish; rejected drafts return.',
    });
    await renderDiagram({ title: 'Publication workflow' });
    vi.useRealTimers();
    expect(screen.getByRole('img')?.tagName).toBe('DIV');
    expect((await runDiagramRules(screen.getByRole('img'))).violations).toEqual([]);
  });

  it('exposes a titled diagram once through its visible caption and retains the generated image', async () => {
    state.render.mockResolvedValue({ src: 'data:image/svg+xml,diagram', width: 180 });
    await renderDiagram({ title: '다이어그램' });
    const diagram = screen.getByRole('img')!;
    expect(diagram.tagName).toBe('DIV');
    expect(diagram).toHaveAttribute('role', 'img');
    expect(diagram).toHaveAttribute('data-mermaid-status', 'ready');
    expect(diagram).toHaveAccessibleName('다이어그램');
    expect(diagram).not.toHaveAttribute('aria-label');
    expect(screen.getAllByRole('img')).toHaveLength(1);
    const caption = screen.getByText('다이어그램');
    expect(diagram).toContainElement(caption);
    const pixels = screen.getByAltText('');
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
    const diagram = screen.getByRole('img')!;
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
    const diagram = screen.getByRole('img')!;
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
    const diagram = screen.getByRole('img')!;
    expect(diagram).toHaveAccessibleName('Publication workflow');
    expect(diagram).not.toHaveAttribute('aria-describedby');
    expect(diagram).toHaveAccessibleDescription('');
  });

  it('keeps loading and error messages exposed before an image exists', async () => {
    state.render.mockImplementationOnce(() => new Promise(() => {}));
    await renderDiagram();
    expect(screen.getByRole('figure')).toHaveAttribute('data-mermaid-status', 'loading');
    expect(screen.getByRole('status')).toHaveTextContent('loading');
    state.render.mockRejectedValueOnce(new Error('Invalid flowchart'));
    await renderDiagram({ source: 'flowchart LR\n A --> [' });
    expect(screen.getByRole('figure')).toHaveAttribute('data-mermaid-status', 'error');
    expect(screen.getByRole('alert')).toHaveTextContent('Invalid flowchart');
  });
});
