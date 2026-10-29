const spacingScale = { xxs: '0.25rem', xs: '0.5rem', sm: '0.625rem', md: '0.75rem', lg: '1rem', xl: '1.5rem' } as const;
/**
 * Text scale (10/11/12/13/14px), one pixel per step. Body text sits at 12px, metadata, supporting text and
 * chrome at 11px, captions and badges at 10px; contrast comes from the title step rather than from large
 * running text.
 */
const fontSizeScale = { xs: '0.625rem', sm: '0.6875rem', md: '0.75rem', lg: '0.8125rem', xl: '0.875rem' } as const;
/** Icon and logo geometry named like the text roles it sits beside, kept independent of the text scale. */
const iconSizeScale = { xs: '0.75rem', sm: '0.875rem', md: '1rem', lg: '1.125rem', xl: '1.25rem' } as const;
/** Line icons draw a 1.5 unit stroke (24-unit grid): hairline enough to sit beside 11–12px text. */
const iconStroke = { stroke: '1.5' } as const;
/** Control geometry sized to the 12px text scale (24/28/32/40/48px); coarse pointers keep the 44px minimum. */
const controlHeightScale = {
  compact: '1.5rem',
  chrome: '1.75rem',
  xs: '1.5rem',
  sm: '1.75rem',
  md: '2rem',
  lg: '2.5rem',
  xl: '3rem',
} as const;

/** Shared visual authority. Grades 50–900 increase in darkness; modes select roles from this palette.
 * Authored color names retain document meaning while their appearance consumes this theme.
 * Third-party brand identities retain their own owners. Red 500 is the unchanged DSUB logo. */
export const primitiveTokens = {
  colors: {
    white: '#ffffff',
    black: '#000000',
    get brand() {
      return this.red[500];
    },
    annotation: '#3b82f6',
    /** Braun light: warm light-grey housings, hairline joins, near-black print. */
    neutral: {
      50: '#f8f7f4',
      100: '#efeeea',
      200: '#e8e6e1',
      300: '#e1dfd9',
      400: '#dcd9d3',
      500: '#cfccc5',
      600: '#85827c',
      700: '#5d5b56',
      800: '#4f4d48',
      900: '#1b1b19',
    },
    /** Braun dark: anthracite housings without a green cast. */
    graphite: {
      50: '#eceae5',
      100: '#c2c0ba',
      200: '#a6a49e',
      300: '#75736e',
      400: '#3a3936',
      500: '#323230',
      600: '#2a2a28',
      700: '#222220',
      800: '#1b1b1a',
      900: '#141413',
    },
    /** Braun signal orange: the one interactive accent (selection, accent actions, the lead data series). */
    signal: {
      100: '#f7b895',
      200: '#f5a273',
      300: '#f28c52',
      700: '#9c3d18',
      800: '#853414',
      900: '#6f2b10',
    },
    blue: {
      50: '#edf5fb',
      100: '#d7eafa',
      200: '#b1d2ed',
      300: '#88b8dc',
      400: '#5193c5',
      500: '#235f96',
      600: '#215884',
      700: '#255274',
      800: '#1d405d',
      900: '#17324a',
    },
    green: {
      50: '#eff7ed',
      100: '#d9ecd2',
      200: '#b3d6a9',
      300: '#82be8b',
      400: '#53a466',
      500: '#287a3f',
      600: '#216d37',
      700: '#245936',
      800: '#1b4829',
      900: '#153621',
    },
    yellow: {
      50: '#fff8dc',
      100: '#f8edb7',
      200: '#f0dc7f',
      300: '#e4c94c',
      400: '#ddba2f',
      500: '#d5a900',
      600: '#a98407',
      700: '#8c6b07',
      800: '#70540a',
      900: '#544008',
    },
    // Reserved material family; no extra status meaning is implied by a palette color.
    orange: {
      50: '#fff1e8',
      100: '#fbe0cb',
      200: '#f2bf96',
      300: '#e9a06d',
      400: '#de7e47',
      500: '#ce5526',
      600: '#ad4720',
      700: '#8d381a',
      800: '#712d15',
      900: '#54230f',
    },
    red: {
      50: '#fbefe9',
      100: '#f5d7cf',
      200: '#f1bbb1',
      300: '#ee9a8f',
      400: '#d96353',
      500: '#b02d23',
      600: '#98261e',
      700: '#802019',
      800: '#671914',
      900: '#4e130f',
    },
    // Authored color families share the default palette without implying command/status tones.
    brown: {
      50: '#f4eeea',
      100: '#e8dcd2',
      200: '#d9bfac',
      300: '#c4a18c',
      400: '#ad8267',
      500: '#95664c',
      600: '#7a523f',
      700: '#614335',
      800: '#4d3428',
      900: '#39271e',
    },
    purple: {
      50: '#f2eef8',
      100: '#e5dcf0',
      200: '#cfc0e3',
      300: '#b29acb',
      400: '#9474b4',
      500: '#795491',
      600: '#68467e',
      700: '#563865',
      800: '#442c51',
      900: '#34213d',
    },
    pink: {
      50: '#f9edf1',
      100: '#f0d8e1',
      200: '#e1b6c7',
      300: '#d393ac',
      400: '#be6e90',
      500: '#a55075',
      600: '#8e405f',
      700: '#74344e',
      800: '#5b2a3e',
      900: '#44222e',
    },
    get ink() {
      return this.graphite[900];
    },
    canvas: '#0f0f0e',
    sourceText: '#24292f',
    sourceBackground: '#f6f8fa',
  },
  spacing: spacingScale,
  /** Repeated spacing relationships. Values derive from the shared scale;
   * controls own internal gaps and composition owners own external gaps. */
  spacingRole: {
    'control-label': spacingScale.xs,
    'control-label-compact': spacingScale.xxs,
    'action-group': spacingScale.xs,
    'toolbar-item': spacingScale.xxs,
    'field-label': spacingScale.xxs,
    'field-column': spacingScale.sm,
    section: spacingScale.xl,
  },
  controlPadding: {
    compact: spacingScale.xxs,
    xs: spacingScale.sm,
    standard: spacingScale.md,
    large: spacingScale.lg,
  },
  /** Default child level and compact reorder alignment, derived from existing system geometry. */
  hierarchy: {
    step: 'var(--geul-spacing-lg)',
    'reorder-step':
      'calc(max(var(--geul-control-height-compact), var(--geul-interaction-minimum)) + var(--geul-spacing-xxs))',
  },
  /**
   * Content maximums. `form` is single-column authentication/account forms; `reading` is the
   * running-prose measure of long documents, one width for every language and script (owner decision:
   * open but bounded; at the md body size about 85 Latin, 55 Hangul or 110 Arabic characters per line);
   * compact/standard/wide are LayoutContainer surfaces and document breakout widths.
   */
  contentWidth: { form: '28rem', reading: '32rem', compact: '48rem', standard: '62rem', wide: '75rem' },
  /** Existing responsive thresholds, shared by theme, Core Layout and generated PostCSS variables. */
  breakpoints: { xs: '36em', sm: '48em', md: '62em', lg: '75em', xl: '88em' },
  fontSize: fontSizeScale,
  iconSize: iconSizeScale,
  icon: iconStroke,
  /**
   * Labels and selection read by ink, tone and position rather than weight: `medium` resolves to regular
   * and `strong` (inline emphasis) is one quiet step above it. Headings use `heading-weight`.
   */
  fontWeight: { regular: '400', medium: '400', strong: '500' },
  /** Small uppercase labels open slightly so capitals stay legible at `xs`; other text keeps normal tracking. */
  letterSpacing: { caps: '0.04em' },
  /**
   * One heading scale for interface and document headings. Values here are the base (below `sm`)
   * sizes; `responsiveTokens.sm` restores the wider-screen steps and `printTokens` the paper steps.
   * `title` is the document title role (Post, Page and public document details), one clear step
   * above an authored body `h1` at every width; h4–h6 follow the text scale at every width.
   */
  heading: {
    title: '1.25rem',
    h1: '1rem',
    h2: '0.9375rem',
    h3: '0.875rem',
    h4: fontSizeScale.lg,
    h5: fontSizeScale.md,
    h6: fontSizeScale.sm,
    'line-height': '1.3',
    /** Headings lead by size and position at one medium weight; `strong` stays for inline emphasis. */
    weight: '500',
  },
  /**
   * xs–xl pair with the text sizes of interface text. `document` is the leading of running text in
   * document bodies (published `.prose`, the editor body, legal/changelog release notes), one value for
   * every script; headings keep `heading-line-height`.
   */
  lineHeight: { xs: '1.4', sm: '1.45', md: '1.55', lg: '1.6', xl: '1.65', document: '1.6' },
  controlHeight: controlHeightScale,
  /** Minimum hit area follows input capability, independently of visual density. `text-minimum` is the
   * smallest text a coarse-pointer text field may use, so mobile browsers do not zoom on focus. */
  interaction: { minimum: '0px', touch: '2.75rem', 'text-minimum': '1rem' },
  /** `sm` (0.375rem, 6px) is a documented off-scale exception: TextButton's middle density
   * sits between the xxs and xs spacing steps. xs/md follow the spacing scale. */
  textControlPadding: { xs: spacingScale.xxs, sm: '0.375rem', md: spacingScale.xs },
  radius: { square: '0', circle: '50%' },
  border: { thin: '1px', focus: '2px' },
  opacity: { disabled: '0.5', 'drag-preview': '0.72' },
  /** Ordered stacking roles (ascending). ApplicationFrame chrome sits directly below `backdrop`.
   * sticky: page-owned pinned surfaces under app chrome; banner: viewport-pinned notices;
   * floating: non-modal tool panels whose own popups/tooltips render above them;
   * toast: transient feedback above modals and popups; progress: route progress, always topmost. */
  layer: {
    sticky: '100',
    backdrop: '200',
    modal: '201',
    banner: '250',
    floating: '260',
    popup: '300',
    toast: '400',
    tooltip: '1000',
    progress: '10000',
  },
  motion: { fast: '100ms', normal: '140ms', slow: '300ms', spin: '1000ms', easing: 'ease-out' },
  chrome: {
    'font-size': fontSizeScale.sm,
    /** Section labels share the chrome text size; 10px was hard to read in Hangul, Kana and Han. */
    'section-font-size': fontSizeScale.sm,
    'row-height': controlHeightScale.chrome,
    'section-row-height': controlHeightScale.compact,
    'menu-row-height': '1.625rem',
    'icon-size': '1rem',
    'compact-item-size': '2.5rem',
    'rail-width': '3rem',
    'header-height-base': '3.25rem',
    'header-height-sm': '4rem',
    /** Anchor clearance follows the responsive ApplicationFrame header. */
    'scroll-offset': 'var(--geul-chrome-header-height-base)',
  },
} as const;

/**
 * Mobile-first responsive projections. Each key replaces an existing role from the named breakpoint
 * up; generation fails for unknown roles or breakpoints. Media queries cannot consume custom properties,
 * so the generator emits these blocks and every consumer (Core Heading, `.prose`, the Tiptap editor)
 * reads the same role at the same width.
 */
export const responsiveTokens = {
  sm: {
    /** Anchor clearance follows the responsive ApplicationFrame header. */
    'chrome-scroll-offset': 'var(--geul-chrome-header-height-sm)',
    'heading-title': '1.5rem',
    'heading-h1': '1.125rem',
    'heading-h2': '1rem',
    'heading-h3': '0.875rem',
  },
} as const;

/**
 * Paper (A4/Letter) projection of the type roles, in physical points. Print media replaces the screen
 * sizes after every responsive block, so text, headings, captions, tables and code print at one
 * paper scale (10.5pt body) without literal sizes in feature or print CSS. Heading roles keep the
 * screen order: title > h1 > h2 > h3 > h4 (lg) > h5 (md) > h6 (sm).
 */
export const printTokens = {
  'font-size-xs': '7.5pt',
  'font-size-sm': '8pt',
  'font-size-md': '9pt',
  'font-size-lg': '9.5pt',
  'font-size-xl': '10.5pt',
  'heading-title': '15pt',
  'heading-h1': '12pt',
  'heading-h2': '11pt',
  'heading-h3': '10pt',
  /** Interface and dense text on paper (tables, metadata): slightly tighter than on screen. */
  'line-height-md': '1.5',
  /**
   * Running document text on paper (9pt): the screen's document leading, kept above the
   * dense role, because the A4 measure is long (about 95 Latin characters) and Hangul fills the em box.
   */
  'line-height-document': '1.6',
} as const;

/** Public role names remain stable; CSS must follow their shared scale rather than copy a value.
 * Generation fails if either endpoint is missing or the TypeScript projection drifts. */
export const derivedTokenRoles = {
  'spacing-role-control-label': 'spacing-xs',
  'spacing-role-control-label-compact': 'spacing-xxs',
  'spacing-role-action-group': 'spacing-xs',
  'spacing-role-toolbar-item': 'spacing-xxs',
  'spacing-role-field-label': 'spacing-xxs',
  'spacing-role-field-column': 'spacing-sm',
  'spacing-role-section': 'spacing-xl',
  'control-padding-compact': 'spacing-xxs',
  'control-padding-xs': 'spacing-sm',
  'control-padding-standard': 'spacing-md',
  'control-padding-large': 'spacing-lg',
  'chrome-font-size': 'font-size-sm',
  'chrome-row-height': 'control-height-chrome',
  'chrome-section-row-height': 'control-height-compact',
  'heading-h4': 'font-size-lg',
  'heading-h5': 'font-size-md',
  'heading-h6': 'font-size-sm',
  'text-control-padding-xs': 'spacing-xxs',
  'text-control-padding-md': 'spacing-xs',
} as const;

/** Durable names remain document data; their appearance follows the default theme.
 * Compatibility aliases preserve the existing --editor-* document contract. */
export const authoredEditorPalettes = {
  light: {
    'text-color-default': 'var(--geul-document-text-default)',
    'text-color-gray': 'var(--geul-document-text-gray)',
    'text-color-brown': 'var(--geul-document-text-brown)',
    'text-color-red': 'var(--geul-document-text-red)',
    'text-color-orange': 'var(--geul-document-text-orange)',
    'text-color-yellow': 'var(--geul-document-text-yellow)',
    'text-color-green': 'var(--geul-document-text-green)',
    'text-color-blue': 'var(--geul-document-text-blue)',
    'text-color-purple': 'var(--geul-document-text-purple)',
    'text-color-pink': 'var(--geul-document-text-pink)',
    'background-color-default': 'var(--geul-document-background-default)',
    'background-color-gray': 'var(--geul-document-background-gray)',
    'background-color-brown': 'var(--geul-document-background-brown)',
    'background-color-red': 'var(--geul-document-background-red)',
    'background-color-orange': 'var(--geul-document-background-orange)',
    'background-color-yellow': 'var(--geul-document-background-yellow)',
    'background-color-green': 'var(--geul-document-background-green)',
    'background-color-blue': 'var(--geul-document-background-blue)',
    'background-color-purple': 'var(--geul-document-background-purple)',
    'background-color-pink': 'var(--geul-document-background-pink)',
  },
  dark: {
    'text-color-default': 'var(--geul-document-text-default)',
    'text-color-gray': 'var(--geul-document-text-gray)',
    'text-color-brown': 'var(--geul-document-text-brown)',
    'text-color-red': 'var(--geul-document-text-red)',
    'text-color-orange': 'var(--geul-document-text-orange)',
    'text-color-yellow': 'var(--geul-document-text-yellow)',
    'text-color-green': 'var(--geul-document-text-green)',
    'text-color-blue': 'var(--geul-document-text-blue)',
    'text-color-purple': 'var(--geul-document-text-purple)',
    'text-color-pink': 'var(--geul-document-text-pink)',
    'background-color-default': 'var(--geul-document-background-default)',
    'background-color-gray': 'var(--geul-document-background-gray)',
    'background-color-brown': 'var(--geul-document-background-brown)',
    'background-color-red': 'var(--geul-document-background-red)',
    'background-color-orange': 'var(--geul-document-background-orange)',
    'background-color-yellow': 'var(--geul-document-background-yellow)',
    'background-color-green': 'var(--geul-document-background-green)',
    'background-color-blue': 'var(--geul-document-background-blue)',
    'background-color-purple': 'var(--geul-document-background-purple)',
    'background-color-pink': 'var(--geul-document-background-pink)',
  },
} as const;

const colors = primitiveTokens.colors;
type PaletteColor = {
  [Family in keyof typeof colors]: (typeof colors)[Family] extends string
    ? (typeof colors)[Family]
    : (typeof colors)[Family][keyof (typeof colors)[Family]];
}[keyof typeof colors];

/** Resolve primitive mixtures to hex so document roles also work in non-CSS renderers. */
function blendPaletteColors(first: PaletteColor, second: PaletteColor, firstWeight: number): string {
  return `#${[1, 3, 5]
    .map((offset) =>
      Math.round(
        Number.parseInt(first.slice(offset, offset + 2), 16) * firstWeight +
          Number.parseInt(second.slice(offset, offset + 2), 16) * (1 - firstWeight),
      )
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;
}

/** Role names stay stable across themes; values change together. */
export const semanticThemes = {
  light: {
    background: colors.neutral[100],
    'chart-series-primary': colors.signal[700],
    'chart-series-secondary': colors.neutral[900],
    'chart-series-tertiary': colors.neutral[600],
    surface: colors.neutral[50],
    'surface-muted': colors.neutral[200],
    'surface-hover': colors.neutral[300],
    'surface-active': colors.neutral[400],
    'text-primary': colors.neutral[900],
    'text-secondary': colors.neutral[800],
    'text-muted': colors.neutral[700],
    // The ink a quiet (secondary or muted) navigation item takes under a pointer: one shared hover step.
    'text-hover': colors.neutral[900],
    'border-default': colors.neutral[500],
    'border-strong': colors.neutral[600],
    // Neutral commands stay quiet; explicit semantic actions share the existing palette.
    'action-ink': colors.neutral[900],
    'action-ink-muted': colors.neutral[700],
    'action-boundary': colors.neutral[600],
    'action-primary': colors.neutral[900],
    'text-on-action': colors.neutral[50],
    'action-primary-hover': colors.neutral[800],
    'action-primary-pressed': colors.neutral[700],
    'action-accent': colors.signal[700],
    'action-accent-hover': colors.signal[800],
    'action-accent-pressed': colors.signal[900],
    'action-positive': colors.green[700],
    'action-positive-hover': colors.green[800],
    'action-positive-pressed': colors.green[900],
    'action-warning': colors.yellow[700],
    'action-warning-hover': colors.yellow[800],
    'action-warning-pressed': colors.yellow[900],
    'action-danger': colors.red[700],
    'action-danger-hover': colors.red[800],
    'action-danger-pressed': colors.red[900],
    focus: colors.neutral[900],
    'status-accent': colors.signal[700],
    'status-positive': colors.green[700],
    'status-warning': colors.yellow[800],
    'status-danger': colors.red[700],
    // Named document colors follow the same default palette as product chrome.
    'document-text-default': colors.neutral[900],
    'document-text-gray': colors.neutral[700],
    'document-text-brown': colors.brown[700],
    'document-text-red': colors.red[700],
    'document-text-orange': colors.orange[700],
    'document-text-yellow': colors.yellow[800],
    'document-text-green': colors.green[700],
    'document-text-blue': colors.blue[700],
    'document-text-purple': colors.purple[700],
    'document-text-pink': colors.pink[700],
    'document-background-default': 'transparent',
    'document-background-gray': colors.neutral[200],
    'document-background-brown': colors.brown[50],
    'document-background-red': colors.red[50],
    'document-background-orange': colors.orange[50],
    'document-background-yellow': colors.yellow[50],
    'document-background-green': colors.green[50],
    'document-background-blue': colors.blue[50],
    'document-background-purple': colors.purple[50],
    'document-background-pink': colors.pink[50],
    'wave-muted': 'rgb(27 27 25 / 14%)',
    'wave-cursor': 'rgb(27 27 25 / 88%)',
    'embed-overlay': 'rgb(255 255 255 / 20%)',
  },
  dark: {
    background: colors.ink,
    'chart-series-primary': colors.signal[300],
    'chart-series-secondary': colors.graphite[50],
    'chart-series-tertiary': colors.graphite[300],
    surface: colors.graphite[800],
    'surface-muted': colors.graphite[700],
    'surface-hover': colors.graphite[600],
    'surface-active': colors.graphite[500],
    'text-primary': colors.graphite[50],
    'text-secondary': colors.graphite[100],
    'text-muted': colors.graphite[200],
    'text-hover': colors.graphite[50],
    'border-default': colors.graphite[400],
    'border-strong': colors.graphite[300],
    // Neutral commands stay quiet; explicit semantic actions share the existing palette.
    'action-ink': colors.graphite[50],
    'action-ink-muted': colors.graphite[200],
    'action-boundary': colors.graphite[300],
    'action-primary': colors.graphite[50],
    'text-on-action': colors.ink,
    'action-primary-hover': colors.graphite[100],
    'action-primary-pressed': colors.graphite[200],
    'action-accent': colors.signal[300],
    'action-accent-hover': colors.signal[200],
    'action-accent-pressed': colors.signal[100],
    'action-positive': colors.green[300],
    'action-positive-hover': colors.green[200],
    'action-positive-pressed': colors.green[100],
    'action-warning': colors.yellow[300],
    'action-warning-hover': colors.yellow[200],
    'action-warning-pressed': colors.yellow[100],
    'action-danger': colors.red[300],
    'action-danger-hover': colors.red[200],
    'action-danger-pressed': colors.red[100],
    focus: colors.graphite[50],
    'status-accent': colors.signal[300],
    'status-positive': colors.green[300],
    'status-warning': colors.yellow[300],
    'status-danger': colors.red[300],
    'document-text-default': colors.graphite[50],
    'document-text-gray': colors.graphite[200],
    'document-text-brown': colors.brown[300],
    'document-text-red': colors.red[300],
    'document-text-orange': colors.orange[300],
    'document-text-yellow': colors.yellow[300],
    'document-text-green': colors.green[300],
    'document-text-blue': colors.blue[300],
    'document-text-purple': colors.purple[300],
    'document-text-pink': colors.pink[300],
    'document-background-default': 'transparent',
    'document-background-gray': colors.graphite[700],
    'document-background-brown': colors.brown[900],
    'document-background-red': colors.red[900],
    'document-background-orange': colors.orange[900],
    // Yellow 900 is brighter than the other dark highlights; lower its luminance
    // without changing the shared warning/action family or independent text choices.
    'document-background-yellow': blendPaletteColors(colors.yellow[900], colors.ink, 0.75),
    'document-background-green': colors.green[900],
    'document-background-blue': colors.blue[900],
    'document-background-purple': colors.purple[900],
    'document-background-pink': colors.pink[900],
    'wave-muted': 'rgb(236 234 229 / 18%)',
    'wave-cursor': 'rgb(236 234 229 / 90%)',
    'embed-overlay': 'rgb(0 0 0 / 20%)',
  },
} as const;

/** Theme-invariant roles for photographs, media canvases and paper output. */
export const invariantTokens = {
  /** Configurable site identity; runtime overrides retain this stable public name. */
  'brand-color': 'var(--geul-brand-default)',
  /** Text on a brand-color fill; siteBrandStyle picks white or ink for the configured color. */
  'brand-ink': colors.white,
  'brand-color-hover': 'color-mix(in srgb, var(--geul-brand-color) 86%, #000)',
  'brand-color-pressed': 'color-mix(in srgb, var(--geul-brand-color) 74%, #000)',
  'text-on-image': colors.white,
  'paper-image-background': '#17282d',
  'paper-image-gradient':
    'linear-gradient(90deg, rgb(4 13 16 / 88%) 0%, rgb(4 13 16 / 56%) 58%, rgb(4 13 16 / 24%) 100%)',
  'paper-image-border': 'rgb(255 255 255 / 58%)',
  'text-inverse-secondary': 'rgb(255 255 255 / 72%)',
  'text-inverse-primary': 'rgb(255 255 255 / 88%)',
  'canvas-dark': colors.canvas,
  'canvas-black': colors.black,
  /** Each theme's page background, for previewing theme-specific assets such as logos. */
  'theme-light-background': colors.neutral[100],
  'theme-dark-background': colors.ink,
  'source-text': colors.sourceText,
  'source-background': colors.sourceBackground,
  'paper-background': colors.white,
  'paper-ink': colors.black,
  'paper-text': '#111111',
  'paper-secondary': '#333333',
  'paper-muted': '#666666',
  'paper-border': '#b5b5b5',
  'paper-border-subtle': '#dddddd',
  'paper-panel': '#f5f5f5',
  'paper-control': '#f3f3f3',
  'paper-code': '#eceff3',
  'paper-caption': '#444444',
  'overlay-subtle': 'rgb(0 0 0 / 12%)',
  'overlay-control': 'rgb(0 0 0 / 28%)',
  'overlay-dialog': 'rgb(0 0 0 / 55%)',
  'overlay-strong': 'rgb(0 0 0 / 82%)',
  'overlay-control-border': 'rgb(255 255 255 / 55%)',
  'overlay-track': 'rgb(255 255 255 / 32%)',
  'overlay-track-hover': 'rgb(255 255 255 / 28%)',
  'overlay-video-gradient': 'linear-gradient(to top, rgb(0 0 0 / 84%) 0%, rgb(0 0 0 / 52%) 62%, transparent 100%)',
  'overlay-header-gradient':
    'linear-gradient(to top, rgb(0 0 0 / 88%) 0%, rgb(0 0 0 / 52%) 56%, rgb(0 0 0 / 30%) 100%)',
  'overlay-card-gradient':
    'linear-gradient(to top, rgb(0 0 0 / 90%) 0%, rgb(0 0 0 / 62%) 34%, rgb(0 0 0 / 24%) 62%, rgb(0 0 0 / 8%) 100%)',
  'shadow-panel': '0 1px 3px rgb(0 0 0 / 10%)',
  'shadow-floating': '0 4px 12px rgb(0 0 0 / 15%)',
  'shadow-map-control': '0 10px 28px rgb(15 23 42 / 16%)',
  'shadow-image-title': '0 1px 3px rgb(0 0 0 / 75%)',
  'shadow-image-label': '0 1px 2px rgb(0 0 0 / 70%)',
  'shadow-video-text': '0 1px 5px rgb(0 0 0 / 72%)',
} as const;

export const controlToneColors = {
  accent: 'var(--geul-status-accent)',
  neutral: 'var(--geul-text-secondary)',
  positive: 'var(--geul-status-positive)',
  warning: 'var(--geul-status-warning)',
  danger: 'var(--geul-status-danger)',
} as const;

export type ThemeMode = keyof typeof semanticThemes;
export type SemanticToken = keyof typeof semanticThemes.light;
export type DesignColorToken = SemanticToken | keyof typeof invariantTokens;
export function tokenVar(name: DesignColorToken) {
  return `var(--geul-${name})`;
}
