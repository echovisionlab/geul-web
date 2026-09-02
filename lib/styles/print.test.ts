import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('global print policy', () => {
  const css = readFileSync(resolve(process.cwd(), 'lib/styles/print.css'), 'utf8');

  it('leaves the physical paper size to the print dialog', () => {
    expect(css).toMatch(/@page\s*\{[^}]*size:\s*auto;[^}]*margin:\s*12mm;/su);
    expect(css).not.toMatch(/@page\s*\{[^}]*size:\s*(?:A3|A4|A5|letter)\b/isu);
  });

  it('opts table headers into standards-based repetition', () => {
    expect(css).toMatch(/thead\s*\{[^}]*display:\s*table-header-group;[^}]*break-inside:\s*avoid;/su);
  });

  it('does not manufacture heading keep-space with pseudo-elements or constrain the whole next block', () => {
    expect(css).not.toMatch(/h[1-6]\s*\+\s*\*/u);
    expect(css).not.toMatch(/h[1-6]::after/u);
  });
});
