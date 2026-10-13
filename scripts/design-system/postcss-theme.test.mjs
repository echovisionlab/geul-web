import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import postcss from 'postcss';

const require = createRequire(import.meta.url);
const config = require('../../postcss.config.cjs');
const plugins = Object.entries(config.plugins).map(([name, options]) => require(name)(options));
const compile = (css) => postcss(plugins).process(css, { from: undefined });

test('light-dark transformation uses the provider theme attribute', async () => {
  // Exercise the preprocessing contract independently of one component's anatomy.
  // TOC now consumes semantic roles directly and needs no light/dark color fork.
  const { root, css: output } = await compile(
    '.control { background-color: light-dark(var(--geul-canvas-black), var(--geul-text-on-image)); }',
  );
  const activeColors = [];
  root.walkRules((rule) => {
    if (rule.selector.includes('.control')) {
      rule.walkDecls('background-color', (decl) => activeColors.push([rule.selector, decl.value]));
    }
  });
  assert.ok(
    activeColors.some(
      ([selector, value]) => selector.includes("[data-geul-theme='dark']") && value === 'var(--geul-text-on-image)',
    ),
  );
  assert.ok(activeColors.some(([selector, value]) => selector === '.control' && value === 'var(--geul-canvas-black)'));
  assert.doesNotMatch(output, /data-mantine-color-scheme|light-dark\(/);
});

test('explicit, root and low-specificity theme mixins share the Geul theme contract', async () => {
  const { css } = await compile(`
    .control { @mixin light { color: var(--geul-text-primary); } @mixin dark { color: var(--geul-text-on-image); } }
    :root { @mixin light-root { color-scheme: light; } @mixin dark-root { color-scheme: dark; } }
    .quiet { @mixin where-light { color: inherit; } @mixin where-dark { color: inherit; } }
    :root { @mixin where-light-root { color-scheme: light; } @mixin where-dark-root { color-scheme: dark; } }
  `);
  assert.match(css, /\[data-geul-theme='dark'\] \.control/);
  assert.match(css, /:root\[data-geul-theme='dark'\]/);
  assert.match(css, /:where\(\[data-geul-theme='dark'\]\) \.quiet/);
  assert.match(css, /:root:where\(:root\[data-geul-theme='dark'\]\)/);
  assert.doesNotMatch(css, /data-mantine-color-scheme/);
});
