import { describe, expect, it, vi } from 'vitest';
import type { Monaco } from '@monaco-editor/react';
import { registerGlslLanguage } from './glsl-language';

function fakeMonaco(existingLanguages: { id: string }[] = []) {
  return {
    languages: {
      getLanguages: vi.fn(() => existingLanguages),
      register: vi.fn(),
      setLanguageConfiguration: vi.fn(),
      setMonarchTokensProvider: vi.fn(),
    },
  } as unknown as Monaco;
}

describe('registerGlslLanguage', () => {
  it('registers the local GLSL language, configuration and Monarch grammar once', () => {
    const monaco = fakeMonaco();

    registerGlslLanguage(monaco);
    registerGlslLanguage(monaco);

    expect(monaco.languages.register).toHaveBeenCalledOnce();
    expect(monaco.languages.register).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'glsl', extensions: expect.arrayContaining(['.frag', '.vert']) }),
    );
    expect(monaco.languages.setLanguageConfiguration).toHaveBeenCalledOnce();
    expect(monaco.languages.setMonarchTokensProvider).toHaveBeenCalledOnce();
  });

  it('uses an existing GLSL id without registering a duplicate', () => {
    const monaco = fakeMonaco([{ id: 'glsl' }]);

    registerGlslLanguage(monaco);

    expect(monaco.languages.register).not.toHaveBeenCalled();
    expect(monaco.languages.setMonarchTokensProvider).toHaveBeenCalledWith(
      'glsl',
      expect.objectContaining({ tokenizer: expect.any(Object) }),
    );
  });
});
