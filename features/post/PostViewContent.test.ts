import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('PostViewContent print flow', () => {
  it('uses ordinary block fragmentation instead of a flex formatting context', () => {
    const css = readFileSync(resolve(process.cwd(), 'features/post/PostViewContent.module.css'), 'utf8');
    const printRules = /@media print\s*\{([\s\S]*)\}\s*$/u.exec(css)?.[1];

    expect(printRules).toMatch(/\.contentFlow\s*\{[^}]*display:\s*block;/su);
  });
});
