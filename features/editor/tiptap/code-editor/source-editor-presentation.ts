import type { editor } from 'monaco-editor';
import { primitiveTokens } from '@/components/core/design-tokens';
import { getThemeDefinition, getThemeTokens, type ThemeId } from '@/lib/theme/themes';

export type SourceEditorDensity = 'standard' | 'compact';
/** Consumers configure editing behavior; the shared adapter owns presentation. */
type SourceEditorBehaviorKey =
  | 'detectIndentation'
  | 'formatOnPaste'
  | 'formatOnType'
  | 'insertSpaces'
  | 'lineNumbers'
  | 'lineNumbersMinChars'
  | 'renderValidationDecorations'
  | 'renderWhitespace'
  | 'tabFocusMode'
  | 'tabSize'
  | 'wordWrap';
export type SourceEditorBehaviorOptions = Pick<editor.IStandaloneEditorConstructionOptions, SourceEditorBehaviorKey> & {
  [Key in Exclude<keyof editor.IStandaloneEditorConstructionOptions, SourceEditorBehaviorKey>]?: never;
};

const behaviorKeys = new Set([
  'detectIndentation',
  'formatOnPaste',
  'formatOnType',
  'insertSpaces',
  'lineNumbers',
  'lineNumbersMinChars',
  'renderValidationDecorations',
  'renderWhitespace',
  'tabFocusMode',
  'tabSize',
  'wordWrap',
]);

export function sourceEditorThemeName(themeId: ThemeId) {
  return `geul-source-${themeId}`;
}

/** Notation categories reuse document colors; the shared adapter owns their contrast. */
export function sourceEditorTheme(themeId: ThemeId): editor.IStandaloneThemeData {
  const roles = getThemeTokens(themeId);
  const { base } = getThemeDefinition(themeId);
  return {
    base: base === 'dark' ? 'vs-dark' : 'vs',
    inherit: true,
    // VS language-specific children take precedence over a generic family rule.
    // Cover those inherited foreground categories without adding a second palette.
    rules: [
      ...[
        '',
        'variable',
        'variable.predefined',
        'variable.parameter',
        'delimiter',
        'delimiter.html',
        'delimiter.xml',
        'operator',
        'operator.scss',
        'operator.sql',
        'operator.swift',
      ].map((token) => ({ token, foreground: roles['text-primary'] })),
      ...[
        'annotation',
        'comment',
        'constant',
        'number',
        'number.hex',
        'attribute.value.number',
        'attribute.value.number.css',
        'attribute.value.unit',
        'attribute.value.unit.css',
        'attribute.value.hex.css',
      ].map((token) => ({ token, foreground: roles['document-text-green'] })),
      ...[
        'keyword',
        'keyword.flow',
        'keyword.flow.scss',
        'keyword.json',
        'type',
        'tag',
        'tag.id.pug',
        'tag.class.pug',
        'meta.scss',
        'meta.tag',
        'metatag',
        'metatag.content.html',
        'metatag.html',
        'metatag.xml',
        'key',
        'attribute.name',
        'predefined.sql',
      ].map((token) => ({ token, foreground: roles['document-text-blue'] })),
      ...[
        'string',
        'string.html',
        'string.sql',
        'string.yaml',
        'string.key.json',
        'string.value.json',
        'regexp',
        'attribute.value',
        'attribute.value.html',
        'attribute.value.xml',
      ].map((token) => ({ token, foreground: roles['document-text-red'] })),
      { token: 'invalid', foreground: roles['status-danger'] },
    ],
    colors: {
      'editor.background': roles.background,
      'editor.foreground': roles['text-primary'],
      'editorLineNumber.foreground': roles['text-muted'],
      'editorLineNumber.activeForeground': roles['text-primary'],
      'editorCursor.foreground': roles['text-primary'],
      'editor.selectionBackground': roles['surface-active'],
      'editor.inactiveSelectionBackground': roles['surface-muted'],
      'editor.selectionHighlightBackground': roles['surface-muted'],
      'editor.wordHighlightBackground': roles['surface-muted'],
      'editor.wordHighlightStrongBackground': roles['surface-active'],
      'editor.findMatchBackground': roles['surface-active'],
      'editor.findMatchBorder': roles.focus,
      'editor.findMatchHighlightBackground': roles['surface-muted'],
      'editor.lineHighlightBackground': roles['surface-muted'],
      'editor.lineHighlightBorder': roles['surface-muted'],
      'editorGutter.background': roles.background,
      'editorIndentGuide.background1': roles['border-default'],
      'editorIndentGuide.activeBackground1': roles['border-strong'],
      'editorWhitespace.foreground': roles['text-muted'],
      'editorOverviewRuler.border': roles['border-default'],
      'editorError.foreground': roles['status-danger'],
      'editorWarning.foreground': roles['status-warning'],
      'editorInfo.foreground': roles['status-accent'],
      'editorHint.foreground': roles['text-muted'],
      // Paired-bracket colorization is separate from syntax token matching.
      'editorBracketHighlight.foreground1': roles['document-text-blue'],
      'editorBracketHighlight.foreground2': roles['document-text-red'],
      'editorBracketHighlight.foreground3': roles['document-text-green'],
      'editorBracketHighlight.foreground4': roles['document-text-blue'],
      'editorBracketHighlight.foreground5': roles['document-text-red'],
      'editorBracketHighlight.foreground6': roles['document-text-green'],
      'editorBracketHighlight.unexpectedBracket.foreground': roles['status-danger'],
      'editorWidget.background': roles.surface,
      'editorWidget.foreground': roles['text-primary'],
      'editorWidget.border': roles['border-default'],
      'editorWidget.resizeBorder': roles['border-strong'],
      'editorSuggestWidget.background': roles.surface,
      'editorSuggestWidget.foreground': roles['text-primary'],
      'editorSuggestWidget.border': roles['border-default'],
      'editorSuggestWidget.selectedBackground': roles['surface-muted'],
      'editorSuggestWidget.selectedForeground': roles['text-primary'],
      'editorSuggestWidget.highlightForeground': roles['text-primary'],
      'editorHoverWidget.background': roles.surface,
      'editorHoverWidget.foreground': roles['text-primary'],
      'editorHoverWidget.border': roles['border-default'],
      'editorHoverWidget.statusBarBackground': roles['surface-muted'],
      'input.background': roles.background,
      'input.foreground': roles['text-primary'],
      'input.border': roles['border-default'],
      'input.placeholderForeground': roles['text-muted'],
      'inputOption.activeBackground': roles['surface-muted'],
      'inputOption.activeBorder': roles['border-strong'],
      'inputOption.activeForeground': roles['text-primary'],
      'inputValidation.errorBackground': roles.surface,
      'inputValidation.errorForeground': roles['status-danger'],
      'inputValidation.warningBackground': roles.surface,
      'inputValidation.warningForeground': roles['status-warning'],
      'inputValidation.infoBackground': roles.surface,
      'inputValidation.infoForeground': roles['status-accent'],
      'inputValidation.errorBorder': roles['status-danger'],
      'inputValidation.warningBorder': roles['status-warning'],
      'inputValidation.infoBorder': roles['status-accent'],
      'button.background': roles.surface,
      'button.foreground': roles['text-primary'],
      'button.hoverBackground': roles['surface-hover'],
      'button.border': roles.surface,
      'button.secondaryBackground': roles.surface,
      'button.secondaryForeground': roles['text-primary'],
      'button.secondaryHoverBackground': roles['surface-hover'],
      'list.activeSelectionBackground': roles['surface-muted'],
      'list.activeSelectionForeground': roles['text-primary'],
      'list.inactiveSelectionBackground': roles['surface-muted'],
      'list.inactiveSelectionForeground': roles['text-primary'],
      'list.hoverBackground': roles['surface-hover'],
      'list.hoverForeground': roles['text-primary'],
      'list.focusBackground': roles['surface-muted'],
      'list.focusForeground': roles['text-primary'],
      'list.focusOutline': roles.focus,
      'menu.background': roles.surface,
      'menu.foreground': roles['text-primary'],
      'menu.border': roles['border-default'],
      'menu.selectionBackground': roles['surface-muted'],
      'menu.selectionForeground': roles['text-primary'],
      'menu.separatorBackground': roles['border-default'],
      'scrollbarSlider.background': `${roles['text-muted']}44`,
      'scrollbarSlider.hoverBackground': `${roles['text-muted']}66`,
      'scrollbarSlider.activeBackground': `${roles['text-muted']}88`,
      focusBorder: roles.focus,
      contrastBorder: roles['border-default'],
    },
  };
}

export function sourceEditorOptions({
  density = 'standard',
  reducedMotion = false,
  rootFontSize = 16,
  fontFamily = 'monospace',
  behavior = {},
}: {
  density?: SourceEditorDensity;
  reducedMotion?: boolean;
  rootFontSize?: number;
  fontFamily?: string;
  behavior?: SourceEditorBehaviorOptions;
} = {}): editor.IStandaloneEditorConstructionOptions {
  if (density !== 'standard' && density !== 'compact') {
    throw new TypeError(`Unsupported source editor density: ${density}`);
  }
  for (const key of Object.keys(behavior)) {
    if (!behaviorKeys.has(key)) {
      throw new TypeError(`Source editor presentation option is owned by the adapter: ${key}`);
    }
  }
  const pixels = (rem: string) => Number.parseFloat(rem) * rootFontSize;
  return {
    automaticLayout: true,
    accessibilitySupport: 'auto',
    bracketPairColorization: { enabled: true, independentColorPoolPerBracketType: true },
    cursorSmoothCaretAnimation: reducedMotion ? 'off' : 'on',
    detectIndentation: true,
    folding: true,
    fontFamily,
    fontLigatures: true,
    fontSize: pixels(primitiveTokens.fontSize[density === 'compact' ? 'xs' : 'sm']),
    lineHeight:
      pixels(primitiveTokens.fontSize[density === 'compact' ? 'xs' : 'sm']) * Number(primitiveTokens.lineHeight.sm),
    formatOnPaste: true,
    formatOnType: true,
    glyphMargin: true,
    guides: { bracketPairs: true, indentation: true },
    insertSpaces: true,
    lineNumbers: 'on',
    lineDecorationsWidth: pixels(primitiveTokens.chrome['icon-size']),
    minimap: { enabled: false },
    padding: {
      top: pixels(primitiveTokens.spacing[density === 'compact' ? 'xxs' : 'xs']),
      bottom: pixels(primitiveTokens.spacing[density === 'compact' ? 'xxs' : 'xs']),
    },
    quickSuggestions: { comments: false, other: true, strings: true },
    renderValidationDecorations: 'on',
    renderWhitespace: 'selection',
    scrollBeyondLastLine: false,
    smoothScrolling: !reducedMotion,
    stickyScroll: { enabled: false },
    tabSize: 2,
    tabFocusMode: true,
    wordWrap: 'on',
    wrappingIndent: 'indent',
    ...behavior,
  };
}
