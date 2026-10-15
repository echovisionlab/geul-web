import { getMermaidAppearance, getMermaidThemeVariables } from './mermaid-appearance';

export const MERMAID_SOURCE_LIMIT = 100_000;
export const DEFAULT_MERMAID_SOURCE = 'flowchart LR\n  A --> B\n  B --> C';
export type MermaidTheme = 'light' | 'dark';
export interface MermaidImage {
  src: string;
  width?: number;
  accessibleTitle?: string;
  accessibleDescription?: string;
}

export interface MermaidAppearance {
  fontFamily: string;
  fontSize: string;
  background: string;
  foreground: string;
  surface: string;
  mutedSurface: string;
  secondaryText: string;
  border: string;
  strongBorder: string;
  line: string;
  accent: string;
  positive: string;
  warning: string;
  danger: string;
  onAction: string;
  seriesPrimary: string;
  seriesSecondary: string;
  seriesTertiary: string;
}

// Mermaid owns global configuration. Keep initialization and rendering in one
// queue so diagrams with different themes cannot overwrite each other's config.
let runtime: Promise<(typeof import('mermaid'))['default']> | undefined;
let queue: Promise<unknown> = Promise.resolve();
let sequence = 0;

/** Read the generated image document's authored metadata, not node labels or DSL guesses. */
function svgAccessibleText(element: Element, attribute: string, fallbackTag: 'title' | 'desc'): string | undefined {
  const ids = element.getAttribute(attribute)?.trim().split(/\s+/u) ?? [];
  const referenced = ids
    .map((id) => element.ownerDocument.getElementById(id)?.textContent?.trim())
    .filter(Boolean)
    .join(' ');
  const fallback = [...element.children].find((child) => child.localName === fallbackTag)?.textContent?.trim();
  return referenced || fallback || undefined;
}

export function renderMermaid(
  source: string,
  theme: MermaidTheme,
  signal: AbortSignal,
  appearance?: MermaidAppearance,
): Promise<MermaidImage> {
  const render = async () => {
    signal.throwIfAborted();
    if (source.length > MERMAID_SOURCE_LIMIT) {
      throw new Error('Diagram source is too long.');
    }
    runtime ??= import('mermaid')
      .then((module) => module.default)
      .catch((error: unknown) => {
        runtime = undefined;
        throw error;
      });
    const mermaid = await runtime;
    signal.throwIfAborted();
    const resolvedAppearance = appearance ?? getMermaidAppearance(theme);
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'strict',
      suppressErrorRendering: true,
      theme: 'base',
      fontFamily: resolvedAppearance.fontFamily,
      themeVariables: getMermaidThemeVariables(theme, resolvedAppearance),
      htmlLabels: false,
      maxTextSize: MERMAID_SOURCE_LIMIT,
      maxEdges: 1_000,
      secure: [
        'secure',
        'securityLevel',
        'startOnLoad',
        'maxTextSize',
        'maxEdges',
        'suppressErrorRendering',
        'htmlLabels',
        'theme',
        'themeCSS',
        'themeVariables',
        'dompurifyConfig',
      ],
    });
    const { svg } = await mermaid.render(`geul-mermaid-${++sequence}`, source);
    signal.throwIfAborted();
    // The SVG remains an image document: authored markup cannot inject DOM,
    // scripts, styles, or click handlers into the surrounding editor/page.
    // Preserve intrinsic size; SVG width="100%" otherwise enlarges tiny graphs
    // to the entire column and can make a vertical diagram several screens tall.
    const element = new DOMParser().parseFromString(svg, 'image/svg+xml').documentElement;
    const width = Number(
      element
        .getAttribute('viewBox')
        ?.trim()
        .split(/[\s,]+/)[2],
    );
    const accessibleTitle = svgAccessibleText(element, 'aria-labelledby', 'title');
    const accessibleDescription = svgAccessibleText(element, 'aria-describedby', 'desc');
    return {
      src: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
      width: Number.isFinite(width) && width > 0 ? width : undefined,
      ...(accessibleTitle ? { accessibleTitle } : {}),
      ...(accessibleDescription ? { accessibleDescription } : {}),
    };
  };
  const result = queue.then(render);
  queue = result.catch(() => undefined);
  return result;
}
