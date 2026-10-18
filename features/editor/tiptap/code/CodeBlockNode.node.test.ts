import { describe, expect, it } from 'vitest';
import { codeEditorModelPath } from './CodeBlockNode';

describe('codeEditorModelPath', () => {
  it('scopes stable model paths to the editor authority instance', () => {
    const visibleLocaleEditor = {};
    const hiddenMirrorEditor = {};
    expect(codeEditorModelPath(visibleLocaleEditor, 'shared-block-id', 'ts')).toBe(
      codeEditorModelPath(visibleLocaleEditor, 'shared-block-id', 'ts'),
    );
    expect(codeEditorModelPath(visibleLocaleEditor, 'shared-block-id', 'ts')).not.toBe(
      codeEditorModelPath(hiddenMirrorEditor, 'shared-block-id', 'ts'),
    );
    expect(codeEditorModelPath(visibleLocaleEditor, 'unsafe/id', 'glsl')).toContain('unsafe%2Fid.glsl');
  });
});
