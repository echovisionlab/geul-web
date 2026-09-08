export const MERMAID_SOURCE_LIMIT = 100_000;
export const DEFAULT_MERMAID_SOURCE = 'flowchart LR\n  A --> B\n  B --> C';
export type MermaidTheme = 'light' | 'dark';
export interface MermaidImage {
  src: string;
  width?: number;
}

export interface MermaidAppearance {
  fontFamily: string;
  fontSize: string;
  background: string;
  foreground: string;
  surface: string;
  border: string;
  line: string;
}

// Mermaid owns global configuration. Keep initialization and rendering in one
// queue so diagrams with different themes cannot overwrite each other's config.
let runtime: Promise<(typeof import('mermaid'))['default']> | undefined;
let queue: Promise<unknown> = Promise.resolve();
let sequence = 0;

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
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'strict',
      suppressErrorRendering: true,
      theme: appearance ? 'base' : theme === 'dark' ? 'dark' : 'default',
      ...(appearance && {
        fontFamily: appearance.fontFamily,
        themeVariables: {
          darkMode: theme === 'dark',
          fontFamily: appearance.fontFamily,
          fontSize: appearance.fontSize,
          background: appearance.background,
          mainBkg: appearance.surface,
          primaryColor: appearance.surface,
          primaryTextColor: appearance.foreground,
          primaryBorderColor: appearance.border,
          secondaryColor: appearance.background,
          secondaryTextColor: appearance.foreground,
          secondaryBorderColor: appearance.border,
          tertiaryColor: appearance.background,
          tertiaryTextColor: appearance.foreground,
          tertiaryBorderColor: appearance.border,
          textColor: appearance.foreground,
          lineColor: appearance.line,
          nodeTextColor: appearance.foreground,
          nodeBorder: appearance.border,
          clusterBkg: appearance.background,
          clusterBorder: appearance.border,
          defaultLinkColor: appearance.line,
          edgeLabelBackground: appearance.background,
          actorBkg: appearance.surface,
          actorBorder: appearance.border,
          actorTextColor: appearance.foreground,
          actorLineColor: appearance.line,
          signalColor: appearance.line,
          signalTextColor: appearance.foreground,
          labelBoxBkgColor: appearance.surface,
          labelBoxBorderColor: appearance.border,
          labelTextColor: appearance.foreground,
          noteBkgColor: appearance.surface,
          noteBorderColor: appearance.border,
          noteTextColor: appearance.foreground,
          activationBkgColor: appearance.surface,
          activationBorderColor: appearance.border,
        },
      }),
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
    return {
      src: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
      width: Number.isFinite(width) && width > 0 ? width : undefined,
    };
  };
  const result = queue.then(render);
  queue = result.catch(() => undefined);
  return result;
}
