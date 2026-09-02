import { describe, expect, it } from 'vitest';
import { resolveNextTextAlignment, TEXT_ALIGNMENT_SHORTCUTS } from './KeyboardShortcutsExtension';

describe('TEXT_ALIGNMENT_SHORTCUTS', () => {
  it('uses Ctrl+Shift arrows for alignment so Alt+Shift can keep native selection behavior', () => {
    expect(TEXT_ALIGNMENT_SHORTCUTS.forward).toBe('Ctrl-Shift-ArrowRight');
    expect(TEXT_ALIGNMENT_SHORTCUTS.backward).toBe('Ctrl-Shift-ArrowLeft');
    expect(Object.values(TEXT_ALIGNMENT_SHORTCUTS)).not.toContain('Alt-Shift-ArrowRight');
    expect(Object.values(TEXT_ALIGNMENT_SHORTCUTS)).not.toContain('Alt-Shift-ArrowLeft');
  });
});

describe('resolveNextTextAlignment', () => {
  it('moves forward until right alignment and then clamps', () => {
    expect(resolveNextTextAlignment('left', 'forward')).toBe('center');
    expect(resolveNextTextAlignment('center', 'forward')).toBe('right');
    expect(resolveNextTextAlignment('right', 'forward')).toBe('right');
  });

  it('moves backward until left alignment and then clamps', () => {
    expect(resolveNextTextAlignment('right', 'backward')).toBe('center');
    expect(resolveNextTextAlignment('center', 'backward')).toBe('left');
    expect(resolveNextTextAlignment('left', 'backward')).toBe('left');
  });

  it('treats unsupported alignments as left', () => {
    expect(resolveNextTextAlignment('justify', 'forward')).toBe('center');
    expect(resolveNextTextAlignment(undefined, 'backward')).toBe('left');
  });
});
