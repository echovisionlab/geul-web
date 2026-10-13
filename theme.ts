import {
  primitiveTokens,
  semanticThemes,
  invariantTokens,
  authoredEditorPalettes,
} from './components/core/design-tokens';
import { getThemeDefinition, getThemeTokens, type ThemeId } from './lib/theme/themes';
/** Framework independent theme projection. Canonical definitions remain in design-tokens.ts. */
export const theme = Object.freeze({
  fontFamily: 'var(--font-family-sans), sans-serif',
  fontFamilyMonospace: 'var(--font-mono), monospace',
  headings: { fontFamily: 'var(--font-family-sans), sans-serif', fontWeight: primitiveTokens.fontWeight.strong },
  fontWeights: primitiveTokens.fontWeight,
  spacing: primitiveTokens.spacing,
  breakpoints: primitiveTokens.breakpoints,
  fontSizes: primitiveTokens.fontSize,
  lineHeights: primitiveTokens.lineHeight,
  defaultRadius: 0,
  respectReducedMotion: true,
  palette: primitiveTokens.colors,
  light: semanticThemes.light,
  dark: semanticThemes.dark,
});
export function themeVariables(themeId: ThemeId) {
  const { base } = getThemeDefinition(themeId);
  return {
    ...Object.fromEntries(
      Object.entries({ ...invariantTokens, ...getThemeTokens(themeId) }).map(([name, value]) => [
        `--geul-${name}`,
        value,
      ]),
    ),
    ...Object.fromEntries(
      Object.entries(authoredEditorPalettes[base]).map(([name, value]) => [`--editor-${name}`, value]),
    ),
  };
}
