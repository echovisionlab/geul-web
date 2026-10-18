import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import postcss from 'postcss';
const require = createRequire(import.meta.url);
const variables = require('../../lib/styles/design-breakpoints.json');
test('generated coarse minimum is shared by controls, menus, accessories and reorder tracks', async () => {
  const source = await readFile(new URL('../../lib/styles/design-tokens.css', import.meta.url), 'utf8');
  const root = postcss.parse(source);
  let coarse = false;
  root.walkAtRules('media', (rule) => {
    if (rule.params !== '(any-pointer: coarse)') return;
    rule.walkDecls('--geul-interaction-minimum', (decl) => {
      assert.equal(decl.value, 'var(--geul-interaction-touch)');
      coarse = true;
    });
  });
  assert(coarse);
  for (const file of [
    'components/core/Control.module.css',
    'components/core/Input/Input.module.css',
    'components/core/DropdownMenu/DropdownMenu.module.css',
    'components/core/Sortable/ReorderGutter.module.css',
  ]) {
    const css = await readFile(new URL(`../../${file}`, import.meta.url), 'utf8');
    assert(css.includes('var(--geul-interaction-minimum)'), file);
  }
  assert(!source.includes('--geul-text-control-height-'));
});
