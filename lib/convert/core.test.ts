import { describe, expect, it } from 'vitest';
import { applyCodeHighlighting } from './core';

describe('code block highlighting', () => {
  it('preloads GLSL and emits light and dark theme tokens', async () => {
    const output = await applyCodeHighlighting(
      '<pre data-language="glsl" data-preview-width="64" data-text-alignment="right" style="width:64%;margin-left:auto"><code>void main() { gl_FragColor = vec4(1.0); }</code></pre>',
    );

    expect(output).toContain('data-language="glsl"');
    expect(output).toContain('data-preview-width="64"');
    expect(output).toContain('data-text-alignment="right"');
    expect(output).toContain('style="width:64%;margin-left:auto;');
    expect(output.match(/<pre[^>]*\sstyle=/g)).toHaveLength(1);
    expect(output).toContain('shiki-themes');
    expect(output).toContain('--shiki-dark-bg:');
    expect(output).toContain('--shiki-dark:');
  });

  it('keeps an unsupported fenced language as plain code HTML', async () => {
    const input = '<pre data-language="not-a-language"><code>&lt;safe&gt;</code></pre>';
    await expect(applyCodeHighlighting(input)).resolves.toBe(input);
  });
});
