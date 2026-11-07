import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const generate = process.argv.includes('--generate');
const commands = [
  ['scripts/design-system/check-story-catalog.mjs'],
  ['scripts/design-system/inventory.mjs', ...(generate ? [] : ['--check'])],
  ['scripts/design-system/page-preview-coverage.mjs', ...(generate ? [] : ['--check'])],
  ['scripts/design-system/feature-preview-index.mjs', ...(generate ? [] : ['--check'])],
  ['scripts/design-system/storybook-component-docs.mjs', ...(generate ? [] : ['--check'])],
  ['scripts/design-system/check-tokens.mjs', ...(generate ? ['--report'] : [])],
  ['scripts/design-system/storybook-handbook.mjs', ...(generate ? [] : ['--check'])],
  ['scripts/design-system/check-layout.mjs'],
  ['scripts/design-system/check-responsive.mjs'],
  ['scripts/design-system/check-framework.mjs'],
  ['scripts/design-system/check-affordances.mjs'],
  ['scripts/design-system/check-actions.mjs'],
  ['scripts/design-system/check-story-globals.mjs'],
];
for (const args of commands) {
  const result = spawnSync(process.execPath, args, { cwd: root, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
