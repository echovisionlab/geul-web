import { describe, expect, it } from 'vitest';
import { resolveCodeBlockLanguage } from './code-block-options';

describe('code block options', () => {
  it('maps durable languages to Monaco ids and model extensions with a truthful plaintext fallback', () => {
    expect(resolveCodeBlockLanguage('js')).toEqual({
      durableLanguage: 'javascript',
      monacoLanguage: 'javascript',
      fileExtension: 'js',
      syntaxHighlighting: true,
    });
    expect(resolveCodeBlockLanguage('typescript')).toMatchObject({
      durableLanguage: 'typescript',
      monacoLanguage: 'typescript',
      fileExtension: 'ts',
    });
    expect(resolveCodeBlockLanguage('glsl')).toMatchObject({
      durableLanguage: 'glsl',
      monacoLanguage: 'glsl',
      fileExtension: 'glsl',
    });
    expect(resolveCodeBlockLanguage('julia')).toMatchObject({ monacoLanguage: 'julia', fileExtension: 'jl' });
    expect(resolveCodeBlockLanguage('mdx')).toMatchObject({ monacoLanguage: 'mdx', fileExtension: 'mdx' });
    expect(resolveCodeBlockLanguage('pug')).toMatchObject({ monacoLanguage: 'pug', fileExtension: 'pug' });
    expect(resolveCodeBlockLanguage('not-a-language')).toEqual({
      durableLanguage: 'text',
      monacoLanguage: 'plaintext',
      fileExtension: 'txt',
      syntaxHighlighting: false,
    });
    expect(resolveCodeBlockLanguage('haml')).toMatchObject({
      durableLanguage: 'haml',
      monacoLanguage: 'plaintext',
      syntaxHighlighting: false,
    });
  });
});
