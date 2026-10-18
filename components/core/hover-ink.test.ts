import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { expect, it } from 'vitest';

const coreRoot = resolve(process.cwd(), 'components/core');

function cssModules(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? cssModules(path) : entry.name.endsWith('.module.css') ? [path] : [];
  });
}

it('gives quiet navigation one shared hover ink instead of a per-component text role', () => {
  const offenders = cssModules(coreRoot).flatMap((file) =>
    [...readFileSync(file, 'utf8').matchAll(/([^{}]*(?::hover|\[data-hovered\])[^{}]*)\{([^}]*)\}/g)]
      .filter(([, , body]) => /(?:^|[\s;])color:\s*var\(--geul-text-(?:primary|secondary|muted)\)/.test(body))
      .map(([, selector]) => `${file.slice(coreRoot.length + 1)}: ${selector.trim()}`),
  );
  expect(offenders).toEqual([]);
});
