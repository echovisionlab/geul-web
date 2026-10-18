import { codeToHtml as fullCodeToHtml } from 'shiki/bundle/full';
import { describe, expect, it } from 'vitest';
import { codeToHtml } from './print-code-highlighter';

const themes = { light: 'github-light', dark: 'github-dark' } as const;

describe('print code highlighter', () => {
  it.each([
    ['js', 'const answer = 42;'],
    ['ts', 'const answer: number = 42;'],
    ['glsl', 'void main() { gl_Position = vec4(0.0); }'],
    ['py', 'print("hello")'],
    ['c++', 'int main() { return 0; }'],
    ['vue', '<script lang="ts">const answer: number = 42;</script>'],
    ['md', '```python\nprint("hello")\n```'],
    ['text', '<plain>\n  whitespace'],
    ['ansi', '\u001b[31mred\u001b[0m'],
  ])('matches the full Shiki HTML for %s including aliases and embedded languages', async (lang, source) => {
    // Grammar/HTML parity must not depend on CPU scheduling: Shiki's default
    // 500 ms per-line budget can truncate either call under parallel CI load.
    // This overrides only the comparison fixtures, never production highlighting.
    const options = { lang, themes, defaultColor: false, tokenizeTimeLimit: 0 } as const;
    expect(await codeToHtml(source, options)).toBe(await fullCodeToHtml(source, options));
  });

  it('rejects unknown languages so the component can preserve its raw fallback', async () => {
    await expect(codeToHtml('source', { lang: 'unsupported-language', themes, defaultColor: false })).rejects.toThrow(
      'not included in this bundle',
    );
  });
});
