import { describe, expect, it } from 'vitest';
import { primitiveTokens } from '@echovisionlab/design-system/tokens';
import { getThemeDefinition, getThemeTokens, themeIds } from '@/lib/theme/themes';
import { sourceEditorOptions, sourceEditorTheme, sourceEditorThemeName } from './source-editor-presentation';

describe('shared source editor presentation', () => {
  it.each(themeIds)('maps %s editor, notation and popup UI to its selected semantic roles', (themeId) => {
    const theme = sourceEditorTheme(themeId);
    const roles = getThemeTokens(themeId);
    expect(sourceEditorThemeName(themeId)).toBe(`geul-source-${themeId}`);
    expect(theme.base).toBe(getThemeDefinition(themeId).base === 'dark' ? 'vs-dark' : 'vs');
    expect(theme.inherit).toBe(true);
    expect(theme.rules).toEqual(
      expect.arrayContaining([
        { token: 'comment', foreground: roles['document-text-green'] },
        { token: 'number', foreground: roles['document-text-green'] },
        { token: 'keyword', foreground: roles['document-text-blue'] },
        { token: 'string', foreground: roles['document-text-red'] },
      ]),
    );
    expect(theme.colors).toMatchObject({
      'editor.background': roles.background,
      'editor.foreground': roles['text-primary'],
      'editor.selectionBackground': roles['surface-active'],
      'editorSuggestWidget.background': roles.surface,
      'editorSuggestWidget.selectedBackground': roles['surface-muted'],
      'editorError.foreground': roles['status-danger'],
      'button.background': roles.surface,
      'button.foreground': roles['text-primary'],
      'button.hoverBackground': roles['surface-hover'],
      focusBorder: roles.focus,
    });
    expect(Object.values(theme.colors).every((color) => /^#[\da-f]{6}(?:[\da-f]{2})?$/i.test(color))).toBe(true);
  });

  it('shares the text/spacing scale, scales with root rem size, and disables motion when requested', () => {
    const options = sourceEditorOptions({ rootFontSize: 20, fontFamily: 'Local mono', reducedMotion: true });
    expect(options).toMatchObject({
      fontFamily: 'Local mono',
      fontSize: Number.parseFloat(primitiveTokens.fontSize.sm) * 20,
      padding: {
        top: Number.parseFloat(primitiveTokens.spacing.xs) * 20,
        bottom: Number.parseFloat(primitiveTokens.spacing.xs) * 20,
      },
      cursorSmoothCaretAnimation: 'off',
      smoothScrolling: false,
    });
    expect(sourceEditorOptions({ density: 'compact' }).fontSize).toBe(
      Number.parseFloat(primitiveTokens.fontSize.xs) * 16,
    );
  });

  it('retains editing behavior while rejecting presentation overrides at runtime', () => {
    expect(sourceEditorOptions({ behavior: { formatOnPaste: false, tabSize: 4, wordWrap: 'off' } })).toMatchObject({
      formatOnPaste: false,
      tabSize: 4,
      wordWrap: 'off',
    });
    for (const key of ['fontSize', 'fontFamily', 'padding', 'theme', 'smoothScrolling', 'minimap']) {
      expect(() => sourceEditorOptions({ behavior: { [key]: 12 } })).toThrow(
        /presentation option is owned by the adapter/,
      );
    }
  });
});
