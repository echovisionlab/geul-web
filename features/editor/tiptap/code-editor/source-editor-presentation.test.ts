import { describe, expect, it } from 'vitest';
import { primitiveTokens } from '@/components/core/design-tokens';
import { sourceEditorOptions } from './source-editor-presentation';

describe('shared source editor presentation', () => {
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
    expect(sourceEditorOptions({ density: 'compact' }).fontSize).toBe(12);
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
