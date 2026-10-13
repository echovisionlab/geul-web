import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import postcss from 'postcss';
import preset from 'postcss-preset-mantine';
import simpleVars from 'postcss-simple-vars';
const require = createRequire(import.meta.url);
const variables = require('../../lib/styles/design-breakpoints.json');
test('production viewport and container owners compile complementary projected boundaries', async () => {
  for (const file of [
    'components/core/Section/Surface.module.css',
    'components/core/DataTable/DataTableView.module.css',
  ]) {
    const source = await readFile(new URL(`../../${file}`, import.meta.url), 'utf8');
    const result = await postcss([preset(), simpleVars({ variables })]).process(source, { from: file });
    assert(!result.css.includes('$mantine-breakpoint-'));
    assert(result.css.includes(file.includes('Surface') ? '(width >= 48em)' : '(width < 48em)'));
  }
});
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
