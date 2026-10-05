import { codeToHtml as fullCodeToHtml } from 'shiki/bundle/full';
import { describe, expect, it, vi } from 'vitest';
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

  it('keeps parity when wall-clock jumps would exhaust the default tokenization budget', async () => {
    const source = 'const answer = 42;';
    const options = { lang: 'js', themes, defaultColor: false } as const;
    const expected = await fullCodeToHtml(source, { ...options, tokenizeTimeLimit: 0 });
    let clock = Date.now();
    const dateNow = vi.spyOn(Date, 'now').mockImplementation(() => (clock += 501));
    try {
      // A scheduling pause can change HTML without any grammar or theme change.
      expect(await codeToHtml(source, options)).not.toBe(expected);
      expect(await fullCodeToHtml(source, options)).not.toBe(expected);
      expect(await codeToHtml(source, { ...options, tokenizeTimeLimit: 0 })).toBe(expected);
      expect(await fullCodeToHtml(source, { ...options, tokenizeTimeLimit: 0 })).toBe(expected);
    } finally {
      dateNow.mockRestore();
    }
  });

  it('rejects unknown languages so the component can preserve its raw fallback', async () => {
    await expect(codeToHtml('source', { lang: 'unsupported-language', themes, defaultColor: false })).rejects.toThrow(
      'not included in this bundle',
    );
  });
});
