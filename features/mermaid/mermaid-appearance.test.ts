// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { semanticThemes } from '@/components/core/design-tokens';
import { readMermaidAppearance } from './mermaid-appearance';
afterEach(() => {
  vi.restoreAllMocks();
  document.body.replaceChildren();
});
describe('Mermaid canonical appearance', () => {
  it.each(['light', 'dark'] as const)(
    'falls back to the existing %s semantic colors when computed variables are unresolved',
    (theme) => {
      const element = document.createElement('figure');
      document.body.append(element);
      const result = readMermaidAppearance(element, theme);
      expect(result.background).toBe(semanticThemes[theme].background);
      expect(result.foreground).toBe(semanticThemes[theme]['text-primary']);
      expect(result.surface).toBe(semanticThemes[theme].surface);
      expect(result.border).toBe(semanticThemes[theme]['border-default']);
      expect(result.line).toBe(semanticThemes[theme]['text-muted']);
      expect(result.mutedSurface).toBe(semanticThemes[theme]['surface-muted']);
      expect(result.accent).toBe(semanticThemes[theme]['status-accent']);
      expect(result.positive).toBe(semanticThemes[theme]['status-positive']);
      expect(result.warning).toBe(semanticThemes[theme]['status-warning']);
      expect(result.danger).toBe(semanticThemes[theme]['status-danger']);
      expect(result.seriesPrimary).toBe(semanticThemes[theme]['chart-series-primary']);
      expect(element.children).toHaveLength(0);
    },
  );
  it('passes concrete computed colors and rejects unsupported modern color syntax', () => {
    const element = document.createElement('figure');
    document.body.append(element);
    vi.spyOn(window, 'getComputedStyle').mockImplementation(
      (node) =>
        ({
          fontFamily: 'Interface',
          fontSize: '14px',
          color:
            (node as HTMLElement).style.color === 'var(--geul-background)' ? 'rgb(250, 250, 250)' : 'color(srgb 1 1 1)',
        }) as CSSStyleDeclaration,
    );
    const result = readMermaidAppearance(element, 'light');
    expect(result.background).toBe('rgb(250, 250, 250)');
    expect(result.foreground).toBe(semanticThemes.light['text-primary']);
    expect(result.fontFamily).toBe('Interface');
    expect(element.children).toHaveLength(0);
  });
});
