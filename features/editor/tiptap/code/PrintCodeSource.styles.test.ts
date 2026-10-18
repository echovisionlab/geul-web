import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';

it('collapses Shiki separator newlines while preserving whitespace inside each code line', () => {
  const css = readFileSync(resolve(process.cwd(), 'features/editor/tiptap/code/PrintCodeSource.module.css'), 'utf8');

  expect(css).toMatch(/pre\.shiki\)[^{]*\{[^}]*white-space:\s*normal\s*!important/isu);
  expect(css).toMatch(/pre\.shiki \.line\)[^{]*\{[^}]*white-space:\s*pre-wrap/isu);
});
